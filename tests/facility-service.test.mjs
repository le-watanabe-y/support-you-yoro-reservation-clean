// Application-core tests (ported from the Support you trial suite).
// Subjects are fixtures; MemoryRepository substitutes Postgres and MemoryDocuments
// substitutes private Storage. Auth, HTTP and the browser are covered elsewhere.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FacilityService } from '../lib/facility-service.mjs';
import { MemoryRepository, MemoryDocuments } from '../lib/memory-repository.mjs';
import { availability } from '../lib/rules.mjs';

const ADMIN = 'fixture-admin', A = 'fixture-parent-a', B = 'fixture-parent-b';
// Monday 2026-10-05 is a regular weekday; bookings open on 10-04 12:00.
const DAY = '2026-10-05';
const profile = { name: '山田 はな', kana: 'やまだ はな', birth: '2022-06-01', guardian: '山田 花子', phone: '090-1234-5678', emergencyName: '山田 太郎（父）', emergencyPhone: '090-8765-4321', pickup: '', allergy: 'なし', history: 'なし', consent: true, emergencyConsent: true };
const pdf = kind => ({ kind, bytes: new TextEncoder().encode('%PDF-1.4 fixture'), contentType: 'application/pdf', ext: 'pdf' });
const confirmation = (b, extra = {}) => ({ id: b.id, version: b.version, registrationVersion: 1, registrationChecked: true, room: 'A', group: '呼吸器', medical: true, infection: true, staffing: true, ...extra });
const rejectsStatus = (promise, status) => assert.rejects(promise, e => e.status === status);

async function fixture(start = `${DAY.replace('05', '04')}T13:00:00+09:00`) {
  let now = new Date(start).toISOString();
  const repo = new MemoryRepository(), store = new MemoryDocuments();
  const app = new FacilityService(repo, { facilityId: 'support-you', documentStore: store, now: () => now });
  await app.initialize({ name: '病児保育室 テスト' });
  await app.ensureOwner(ADMIN, { name: '管理者', email: 'admin@example.com' });
  return { app, repo, store, setClock: value => { now = new Date(value).toISOString(); } };
}
async function child(app, subject = A, overrides = {}) {
  await app.openHousehold(subject);
  return app.command(subject, 'parent', 'register-child', { ...profile, ...overrides });
}
const reserve = (app, subject, childId, overrides = {}) => app.command(subject, 'parent', 'reserve', { childId, date: DAY, start: '09:00', end: '17:00', symptom: '発熱 38.2℃', medication: false, agree: true, requestId: crypto.randomUUID(), ...overrides });
const booking = async (app, subject, id, role = 'parent') => (await app.read(subject, role)).bookings.find(b => b.id === id);
async function prepare(app, subject = A, overrides = {}) {
  const c = await child(app, subject, overrides.child), b = await reserve(app, subject, c.id, overrides.booking);
  await app.submitDocuments(subject, { id: b.id, version: 1, files: [pdf('physician'), pdf('medicine')] });
  return { c, b: await booking(app, subject, b.id) };
}
async function confirm(app, subject = A, extra = {}, overrides = {}) {
  const { c, b } = await prepare(app, subject, overrides);
  await app.command(ADMIN, 'staff', 'confirm', confirmation(b, extra));
  return { c, b: await booking(app, subject, b.id) };
}

test('availability follows the real calendar: weekends, holidays, window and closing', async () => {
  const { app, setClock } = await fixture('2026-10-02T10:00:00+09:00'); // Friday
  const s = await app.state();
  assert.equal(availability(s, '2026-10-03'), '休園'); // Saturday
  assert.equal(availability(s, '2026-10-12'), '休園'); // Sports Day
  assert.equal(availability(s, '2026-12-30'), '休園'); // year-end
  assert.equal(availability(s, '2026-10-02'), '予約可');
  assert.equal(availability(s, '2026-10-05'), '受付開始前');
  setClock('2026-10-02T10:01:00+09:00');
  assert.equal(availability(await app.state(), '2026-10-02'), '受付終了', 'no remaining arrival time');
  setClock('2026-10-04T12:00:00+09:00');
  assert.equal(availability(await app.state(), '2026-10-05'), '予約可', 'opens at noon on the previous day');
  assert.equal(availability(await app.state(), '2026-10-01'), '受付終了');
});

test('registration gate, real profile validation and full workflow to checkout with fee', async () => {
  const { app, setClock } = await fixture();
  await app.openHousehold(A);
  await rejectsStatus(reserve(app, A, 'x'), 403);
  await rejectsStatus(app.command(A, 'parent', 'register-child', { ...profile, phone: 'abc' }), 400);
  await rejectsStatus(app.command(A, 'parent', 'register-child', { ...profile, birth: '2010-01-01' }), 400);
  await rejectsStatus(app.command(A, 'parent', 'register-child', { ...profile, name: '' }), 400);
  const c = await app.command(A, 'parent', 'register-child', profile);
  const state = await app.read(A, 'parent');
  assert.equal(state.availability.length, 7);
  assert.equal(state.availability.find(d => d.date === DAY).status, '予約可');
  const b = await reserve(app, A, c.id);
  assert.equal(b.status, 'pending');
  await rejectsStatus(app.command(ADMIN, 'staff', 'confirm', confirmation(await booking(app, A, b.id))), 409); // documents missing
  await app.submitDocuments(A, { id: b.id, version: 1, files: [pdf('physician')] });
  let current = await booking(app, ADMIN, b.id, 'staff');
  assert.equal(current.documents.length, 1);
  await app.command(ADMIN, 'staff', 'return-documents', { id: b.id, version: current.version, reason: '医師の署名がありません' });
  current = await booking(app, A, b.id);
  assert.equal(current.status, 'needs_documents');
  assert.equal(current.reason, '医師の署名がありません');
  await app.submitDocuments(A, { id: b.id, version: current.version, files: [pdf('physician')] });
  current = await booking(app, ADMIN, b.id, 'staff');
  assert.deepEqual(current.documents.map(d => [d.revision, d.active]), [[1, false], [2, true]]);
  await app.command(ADMIN, 'staff', 'confirm', confirmation(current));
  current = await booking(app, A, b.id);
  assert.equal(current.status, 'confirmed');
  assert.equal((await app.read(A, 'parent')).children[0].status, 'approved', 'first approval also approves the registration');
  await rejectsStatus(app.command(ADMIN, 'staff', 'check-in', { id: b.id, version: current.version, checked: true }), 409); // not the day
  setClock(`${DAY}T08:40:00+09:00`);
  await app.command(ADMIN, 'staff', 'check-in', { id: b.id, version: current.version, checked: true });
  setClock(`${DAY}T12:30:00+09:00`);
  current = await booking(app, A, b.id);
  await app.command(ADMIN, 'staff', 'complete', { id: b.id, version: current.version, checked: true, pickup: '山田 太郎' });
  current = await booking(app, A, b.id);
  assert.equal(current.status, 'completed');
  assert.equal(current.fee, 1000);
  assert.equal(current.pickup, '山田 太郎');
});

test('parent cannot read or change another household, nor act as staff', async () => {
  const { app } = await fixture();
  const { b } = await prepare(app, A);
  await child(app, B, { name: '別家庭 こ' });
  const other = await app.read(B, 'parent');
  assert.equal(other.bookings.length, 0);
  assert.equal(other.children.length, 1);
  await rejectsStatus(app.command(B, 'parent', 'cancel', { id: b.id, version: b.version }), 404);
  const doc = (await booking(app, ADMIN, b.id, 'staff')).documents[0];
  await rejectsStatus(app.readDocument(B, 'parent', doc.id), 404);
  assert.ok((await app.readDocument(A, 'parent', doc.id)).bytes.length > 0);
  await rejectsStatus(app.read(A, 'staff'), 403);
  await rejectsStatus(app.command(A, 'staff', 'confirm', confirmation(b)), 403);
  await rejectsStatus(app.command(A, 'parent', 'confirm', confirmation(b)), 404);
});

test('idempotent retransmission and changed payload with same request id', async () => {
  const { app } = await fixture();
  const c = await child(app);
  const requestId = crypto.randomUUID();
  const first = await reserve(app, A, c.id, { requestId });
  const again = await reserve(app, A, c.id, { requestId });
  assert.equal(again.id, first.id);
  assert.equal(again.repeated, true);
  await rejectsStatus(reserve(app, A, c.id, { requestId, end: '12:00' }), 409);
  await rejectsStatus(reserve(app, A, c.id), 409); // same child, same day
});

test('capacity: six per day, three per room, one infection group per room, under races', async () => {
  const { app } = await fixture();
  const prepared = [];
  for (let i = 0; i < 8; i++) prepared.push(await prepare(app, `parent-${i}`, { child: { name: `児童 ${i}` } }));
  const results = await Promise.allSettled(prepared.map(({ b }, i) => app.command(ADMIN, 'staff', 'confirm', confirmation(b, { room: i % 2 ? 'B' : 'A' }))));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 6);
  const staff = await app.read(ADMIN, 'staff');
  const confirmed = staff.bookings.filter(b => b.status === 'confirmed');
  assert.equal(confirmed.filter(b => b.room === 'A').length, 3);
  assert.equal(confirmed.filter(b => b.room === 'B').length, 3);
  const { app: app2 } = await fixture();
  const one = await prepare(app2, 'p1'), two = await prepare(app2, 'p2', { child: { name: '別の子' } });
  await app2.command(ADMIN, 'staff', 'confirm', confirmation(one.b));
  await rejectsStatus(app2.command(ADMIN, 'staff', 'confirm', confirmation(two.b, { group: '消化器' })), 409);
});

test('waitlist needs parent intent and a fresh staff decision; expiry never silently releases', async () => {
  const { app, setClock } = await fixture();
  await app.command(ADMIN, 'staff', 'capacity', { date: DAY, capacity: 1 });
  const first = await confirm(app, A);
  const { b } = await prepare(app, B, { child: { name: '待機 こ' } });
  assert.equal(b.status, 'waitlisted');
  await rejectsStatus(app.command(ADMIN, 'staff', 'confirm', confirmation(b)), 409);
  await app.command(A, 'parent', 'cancel', { id: first.b.id, version: first.b.version });
  let w = await booking(app, ADMIN, b.id, 'staff');
  await app.command(ADMIN, 'staff', 'offer', { ...confirmation(w), expiresAt: `${DAY}T08:00:00+09:00` });
  w = await booking(app, B, b.id);
  assert.equal(w.status, 'offer_pending');
  setClock(`${DAY}T08:10:00+09:00`);
  await rejectsStatus(app.command(B, 'parent', 'offer-reply', { id: b.id, version: w.version, accept: true }), 409);
  assert.equal((await booking(app, B, b.id)).status, 'offer_pending', 'held until staff processes expiry');
  await app.command(ADMIN, 'staff', 'expire-offer', { id: b.id, version: w.version });
  assert.equal((await booking(app, B, b.id)).status, 'waitlisted');
});

test('late cancellation becomes a request and keeps the slot until staff accepts', async () => {
  const { app, setClock } = await fixture();
  const { b } = await confirm(app);
  setClock(`${DAY}T08:30:00+09:00`);
  await app.command(A, 'parent', 'cancel', { id: b.id, version: b.version });
  let current = await booking(app, ADMIN, b.id, 'staff');
  assert.equal(current.status, 'cancel_requested');
  assert.equal(current.room, 'A');
  await rejectsStatus(app.command(ADMIN, 'staff', 'capacity', { date: DAY, capacity: 0 }), 409);
  await app.command(ADMIN, 'staff', 'accept-cancel', { id: b.id, version: current.version });
  current = await booking(app, ADMIN, b.id, 'staff');
  assert.equal(current.status, 'cancelled');
  assert.equal(current.room, null);
});

test('closure keeps checked-in children with an incident, holds confirmed ones, rejects the rest', async () => {
  const { app, setClock } = await fixture();
  const inside = await confirm(app, A);
  const held = await confirm(app, B, { room: 'B' }, { child: { name: '二人目' } });
  const open = await prepare(app, 'parent-c', { child: { name: '三人目' } });
  setClock(`${DAY}T09:05:00+09:00`);
  await app.command(ADMIN, 'staff', 'check-in', { id: inside.b.id, version: inside.b.version, checked: true });
  await app.command(ADMIN, 'staff', 'close-day', { date: DAY, confirm: true, reason: '職員の急病' });
  const s = await app.read(ADMIN, 'staff');
  const status = id => s.bookings.find(b => b.id === id).status;
  assert.equal(status(inside.b.id), 'checked_in');
  assert.equal(status(held.b.id), 'cancel_requested');
  assert.equal(status(open.b.id), 'rejected');
  const incident = s.tasks.find(t => t.resolved === false);
  assert.ok(incident);
  const b = s.bookings.find(x => x.id === inside.b.id);
  await rejectsStatus(app.command(ADMIN, 'staff', 'resolve-incident', { id: b.id, version: b.version, incidentId: incident.id, checked: true }), 409);
});

test('staff management: operator limits, last admin protection, invitations', async () => {
  const { app } = await fixture();
  const invited = await app.acceptStaffInvitation('fixture-operator', { permission: 'operator', name: '看護師 佐藤', email: 'sato@example.com', invitationId: 'inv-1' });
  await rejectsStatus(app.acceptStaffInvitation('fixture-operator', { permission: 'operator', invitationId: 'inv-1' }), 409);
  await rejectsStatus(app.command('fixture-operator', 'staff', 'capacity', { date: DAY, capacity: 3 }), 403);
  await rejectsStatus(app.staffMembership('fixture-operator', { memberId: invited.id, permission: 'admin', active: true, version: 1 }), 403);
  const s = await app.read(ADMIN, 'staff');
  const admin = s.staff.find(m => m.permission === 'admin');
  await rejectsStatus(app.staffMembership(ADMIN, { memberId: admin.id, permission: 'admin', active: false, version: admin.version }), 409);
  await app.staffMembership(ADMIN, { memberId: invited.id, permission: 'operator', active: false, version: 1 });
  await rejectsStatus(app.read('fixture-operator', 'staff'), 403);
});

test('document storage failure leaves the booking unchanged and quarantines attempted keys', async () => {
  const { app, store } = await fixture();
  const c = await child(app), b = await reserve(app, A, c.id, { medication: true });
  store.failNext = 1;
  await rejectsStatus(app.submitDocuments(A, { id: b.id, version: 1, files: [pdf('physician'), pdf('medicine')] }), 503);
  const current = await booking(app, A, b.id);
  assert.equal(current.physician, false);
  assert.equal(current.documents.length, 0);
  assert.equal(store.quarantined.size, 2);
  await rejectsStatus(app.submitDocuments(A, { id: b.id, version: 1, files: [pdf('physician')] }), 400); // medicine needed
});

test('lost commit response on retry returns the original reservation', async () => {
  const { app, repo } = await fixture();
  const c = await child(app);
  const requestId = crypto.randomUUID();
  // The commit succeeds but the caller never sees the response.
  const change = repo.change.bind(repo);
  repo.change = async (...args) => { await change(...args); throw new Error('response lost'); };
  await assert.rejects(reserve(app, A, c.id, { requestId }));
  repo.change = change;
  const retried = await reserve(app, A, c.id, { requestId });
  assert.equal(retried.repeated, true);
  assert.equal((await app.read(A, 'parent')).bookings.length, 1);
});

test('concurrent writer forces a re-read instead of overwriting', async () => {
  const { app, repo } = await fixture();
  const c = await child(app);
  let injected = false;
  repo.beforeCommit = async ({ key }) => {
    if (injected) return; injected = true;
    const row = repo.rows.get(key), state = JSON.parse(row.data);
    state.dayCapacity[DAY] = 0; repo.rows.set(key, { revision: row.revision + 1, data: JSON.stringify(state) });
  };
  const b = await reserve(app, A, c.id);
  repo.beforeCommit = null;
  assert.equal(b.status, 'waitlisted', 'the retry saw the concurrent capacity change');
});

test('finished bookings are archived after 45 days and stay in the parent history', async () => {
  const { app, repo, setClock } = await fixture();
  const c = await child(app), b = await reserve(app, A, c.id);
  await app.command(A, 'parent', 'cancel', { id: b.id, version: 1 });
  setClock('2026-12-01T10:00:00+09:00');
  await app.openHousehold(B); // any write compacts
  const s = await app.state();
  assert.equal(s.bookings.length, 0);
  const archived = await app.archived({ owner: (await app.read(A, 'parent')).user.householdId });
  assert.equal(archived.length, 1);
  assert.equal(archived[0].data.booking.status, 'cancelled');
});

// ---- Per-facility house rules ----
async function withRules(app, change) {
  const s = await app.read(ADMIN, 'staff');
  const settings = structuredClone(s.settings);
  change(settings);
  return app.command(ADMIN, 'staff', 'update-settings', { version: s.settings.version, settings });
}

test('two facilities keep separate data and separate house rules', async () => {
  const repo = new MemoryRepository(), store = new MemoryDocuments();
  const now = () => new Date('2026-10-04T13:00:00+09:00').toISOString();
  const yoro = new FacilityService(repo, { facilityId: 'yoro', documentStore: store, now });
  const ogaki = new FacilityService(repo, { facilityId: 'ogaki', documentStore: store, now });
  for (const [app, name] of [[yoro, '養老'], [ogaki, '大垣']]) { await app.initialize({ name }); await app.ensureOwner(ADMIN); }
  await withRules(ogaki, s => { s.openWeekdays = [0, 1, 2, 3, 4, 5, 6]; s.dailyCapacity = 2; });
  const c = await child(yoro);
  await reserve(yoro, A, c.id);
  assert.equal((await ogaki.read(ADMIN, 'staff')).bookings.length, 0, 'bookings never leak between facilities');
  await rejectsStatus(ogaki.read(A, 'parent'), 403);
  const yoroState = await yoro.state(), ogakiState = await ogaki.state();
  assert.equal(availability(yoroState, '2026-10-10'), '休園'); // Saturday closed in 養老
  assert.equal(availability(ogakiState, '2026-10-10'), '受付開始前'); // open in 大垣
  assert.equal((await ogaki.read(ADMIN, 'staff')).settings.dailyCapacity, 2);
  assert.equal((await yoro.read(ADMIN, 'staff')).settings.dailyCapacity, 6);
});

test('house rules drive capacity, waitlist, fees, age limits and documents', async () => {
  const { app, setClock } = await fixture();
  await withRules(app, s => {
    s.dailyCapacity = 1; s.waitlist = false; s.requireMedicineDoc = false; s.ageMinMonths = 12; s.ageMaxYears = 6;
    s.rooms = [{ name: '1号室', capacity: 1 }]; s.groups = ['感染症', '非感染症'];
    s.fees = [{ maxHours: 2, amount: 500 }, { maxHours: 5, amount: 1500 }, { maxHours: null, amount: 2500 }];
  });
  await app.openHousehold(A);
  await rejectsStatus(app.command(A, 'parent', 'register-child', { ...profile, birth: '2015-01-01' }), 400); // over 6
  const baby = await app.command(A, 'parent', 'register-child', { ...profile, name: '赤ちゃん', birth: '2026-03-01' });
  await rejectsStatus(reserve(app, A, baby.id), 409); // under 12 months on the day
  const c = await app.command(A, 'parent', 'register-child', profile);
  const b = await reserve(app, A, c.id, { medication: true });
  await app.submitDocuments(A, { id: b.id, version: 1, files: [pdf('physician')] }); // medicine doc optional here
  let current = await booking(app, ADMIN, b.id, 'staff');
  await rejectsStatus(app.command(ADMIN, 'staff', 'confirm', confirmation(current)), 400); // room A no longer exists
  await app.command(ADMIN, 'staff', 'confirm', confirmation(current, { room: '1号室', group: '感染症' }));
  const other = await child(app, B, { name: '二人目' });
  assert.equal((await app.read(B, 'parent')).availability.find(d => d.date === DAY).status, '満員');
  await rejectsStatus(reserve(app, B, other.id), 409); // no waitlist in this facility
  setClock(`${DAY}T09:00:00+09:00`);
  current = await booking(app, ADMIN, b.id, 'staff');
  await app.command(ADMIN, 'staff', 'check-in', { id: b.id, version: current.version, checked: true });
  setClock(`${DAY}T13:00:00+09:00`); // 4 hours → second tier
  current = await booking(app, ADMIN, b.id, 'staff');
  await app.command(ADMIN, 'staff', 'complete', { id: b.id, version: current.version, checked: true });
  assert.equal((await booking(app, A, b.id)).fee, 1500);
});

test('settings are validated, versioned, admin only and kept in history', async () => {
  const { app } = await fixture();
  await app.acceptStaffInvitation('nurse', { permission: 'operator', name: '看護師', invitationId: 'x' });
  const s = await app.read(ADMIN, 'staff');
  await rejectsStatus(app.command('nurse', 'staff', 'update-settings', { version: s.settings.version, settings: s.settings }), 403);
  await rejectsStatus(withRules(app, x => { x.openWeekdays = []; }), 400);
  await rejectsStatus(withRules(app, x => { x.fees = [{ maxHours: 4, amount: 1000 }]; }), 400);
  await rejectsStatus(withRules(app, x => { x.dailyCapacity = 10; }), 400); // exceeds room total 6
  await rejectsStatus(withRules(app, x => { x.arrivalTimes = ['25:00']; }), 400);
  const saved = await withRules(app, x => { x.profile.phone = '0584-00-0000'; x.closeOnHolidays = false; });
  assert.equal(saved.version, 2);
  await rejectsStatus(app.command(ADMIN, 'staff', 'update-settings', { version: 1, settings: s.settings }), 409); // stale form
  const after = await app.read(ADMIN, 'staff');
  assert.equal(after.settings.profile.phone, '0584-00-0000');
  assert.equal(after.settingsHistory.at(-1).version, 1);
  assert.equal(availability(await app.state(), '2026-10-12'), '受付開始前', 'holiday opens when the facility decides so');
});
