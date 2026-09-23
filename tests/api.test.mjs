// HTTP boundary tests: sessions, CSRF, role separation, uploads, invitations, export.
// The in-memory backend substitutes Supabase Auth/Postgres/Storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../lib/server/api.mjs';
import { confirmLink } from '../lib/server/confirm.mjs';
import { createMemoryBackend } from '../lib/server/memory-backend.mjs';

const ORIGIN = 'https://yoyaku.example.jp';
const SETUP = 'setup-code-for-tests-0001';
const env = { SUPPORTYOU_SETUP_CODE: SETUP, SUPPORTYOU_FACILITY_EMAIL: 'facility@example.jp', RESEND_API_KEY: '', SUPPORTYOU_MAIL_FROM: '' };
const profile = { name: '山田 はな', kana: 'やまだ はな', birth: '2022-06-01', guardian: '山田 花子', phone: '090-1234-5678', emergencyName: '山田 太郎（父）', emergencyPhone: '090-8765-4321', allergy: 'なし', history: 'なし', consent: true, emergencyConsent: true };
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

function world(now = '2026-10-04T13:00:00+09:00') {
  let clock = new Date(now).toISOString();
  const backend = createMemoryBackend({ now: () => clock });
  const tasks = [];
  const client = (role, facility = 'yoro') => {
    const jar = new Map();
    const call = async (action, { body, method, headers = {}, form, query = '', f = facility } = {}) => {
      query = f ? (query ? `${query}&f=${f}` : `?f=${f}`) : query;
      const isGet = method === 'GET' || ['state', 'document', 'export', 'backup', 'facilities'].includes(action) && body === undefined && !form;
      const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
      const init = { method: isGet ? 'GET' : 'POST', headers: { cookie, ...(isGet ? {} : { origin: ORIGIN, 'x-supportyou-request': '1' }), ...(form ? {} : isGet ? {} : { 'content-type': 'application/json' }), ...headers } };
      if (!isGet) init.body = form || JSON.stringify(body ?? {});
      const response = await handleApi(new Request(`${ORIGIN}/api/${role}/${action}${query}`, init), { role, action, backend, env, defer: fn => tasks.push(fn()) });
      for (const set of response.headers.getSetCookie()) { const [pair] = set.split(';'); const [k, v] = pair.split('='); if (set.includes('Max-Age=0')) jar.delete(k); else jar.set(k, v); }
      const type = response.headers.get('content-type') || '';
      return { status: response.status, headers: response.headers, data: type.includes('json') ? await response.json() : await response.arrayBuffer() };
    };
    return { call, jar, ok: async (action, options) => { const r = await call(action, options); assert.equal(r.status, 200, `${role}:${action} ${JSON.stringify(r.data)}`); return r.data; } };
  };
  return { backend, client, tasks, setClock: v => { clock = new Date(v).toISOString(); } };
}
async function admin(w) { const staff = w.client('staff'); await staff.ok('setup', { body: { email: 'admin@example.jp', password: 'admin-password-1', name: '園長', setupCode: SETUP, facilityId: 'yoro', facilityName: '病児保育室 養老' } }); return staff; }
async function parent(w, address = 'parent@example.jp') {
  const p = w.client('parent');
  await p.ok('signup', { body: { email: address, password: 'parent-password-1', consent: true } });
  return p;
}

test('setup requires the deploy-time code and only works once', async () => {
  const w = world(), staff = w.client('staff');
  assert.equal((await staff.ok('state')).setupAvailable, true);
  assert.equal((await staff.call('setup', { body: { email: 'a@example.jp', password: 'admin-password-1', setupCode: 'wrong-code-wrong-code', facilityId: 'yoro', facilityName: 'x' } })).status, 403);
  await admin(w);
  assert.equal((await w.client('staff').call('setup', { body: { email: 'b@example.jp', password: 'admin-password-1', setupCode: SETUP, facilityId: 'other', facilityName: 'x' } })).status, 409);
  assert.equal((await w.client('staff').ok('state')).setupAvailable, false);
});

test('parent signup, session cookies, registration and reservation', async () => {
  const w = world(); await admin(w);
  const p = await parent(w);
  assert.ok(p.jar.has('__Host-sy-parent') && p.jar.has('__Host-sy-parent-refresh'));
  let s = await p.ok('state');
  assert.equal(s.authenticated, true);
  assert.equal(s.user.complete, false);
  await p.ok('register-child', { body: profile });
  s = await p.ok('state');
  const r = await p.ok('reserve', { body: { childId: s.children[0].id, date: '2026-10-05', start: '09:00', end: '15:00', symptom: '発熱', medication: false, agree: true, requestId: crypto.randomUUID() } });
  assert.equal(r.status, 'pending');
  const logout = await p.call('logout', { body: {} });
  assert.equal(logout.status, 200);
  assert.equal(p.jar.size, 0);
  assert.equal((await p.ok('state')).authenticated, false);
  await p.ok('login', { body: { email: 'PARENT@example.jp', password: 'parent-password-1' } });
  assert.equal((await p.ok('state')).bookings.length, 1);
});

test('CSRF: POST without same origin or marker header is refused', async () => {
  const w = world(); await admin(w);
  const p = await parent(w);
  assert.equal((await p.call('register-child', { body: profile, headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await p.call('register-child', { body: profile, headers: { 'x-supportyou-request': '0' } })).status, 403);
  assert.equal((await p.call('register-child', { body: profile, headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await p.call('state', { method: 'POST', body: {} })).status, 405);
});

test('roles are separated: parents cannot use the staff API and staff cannot use the parent API', async () => {
  const w = world(); const staff = await admin(w);
  const p = await parent(w);
  const asStaff = w.client('staff');
  assert.equal((await asStaff.call('login', { body: { email: 'parent@example.jp', password: 'parent-password-1' } })).status, 403);
  const asParent = w.client('parent');
  assert.equal((await asParent.call('login', { body: { email: 'admin@example.jp', password: 'admin-password-1' } })).status, 403);
  // Parent cookie presented to the staff endpoint is a different cookie name: not signed in.
  const forged = w.client('staff'); forged.jar.set('__Host-sy-staff', p.jar.get('__Host-sy-parent'));
  assert.equal((await forged.call('confirm', { body: {} })).status, 403);
  assert.equal((await staff.ok('state')).permission, 'admin');
});

test('wrong password and unknown account give the same answer; login is rate limited', async () => {
  const w = world(); await admin(w); await parent(w);
  const p = w.client('parent');
  const wrong = await p.call('login', { body: { email: 'parent@example.jp', password: 'nope-nope-nope' } });
  const unknown = await p.call('login', { body: { email: 'nobody@example.jp', password: 'nope-nope-nope' } });
  assert.equal(wrong.status, unknown.status);
  assert.equal(wrong.data.error, unknown.data.error);
  let last;
  for (let i = 0; i < 11; i++) last = await p.call('login', { body: { email: 'parent@example.jp', password: 'nope-nope-nope' } });
  assert.equal(last.status, 429);
});

test('document upload: signature sniffing, private download, staff confirmation', async () => {
  const w = world(); const staff = await admin(w);
  const p = await parent(w), other = await parent(w, 'other@example.jp');
  await p.ok('register-child', { body: profile });
  const childId = (await p.ok('state')).children[0].id;
  const { id } = await p.ok('reserve', { body: { childId, date: '2026-10-05', start: '09:00', end: '15:00', symptom: '発熱', medication: false, agree: true, requestId: crypto.randomUUID() } });
  const fake = new FormData(); fake.set('id', id); fake.set('version', '1'); fake.set('physician', new File(['<script>alert(1)</script>'], 'x.jpg', { type: 'image/jpeg' }));
  assert.equal((await p.call('documents', { form: fake })).status, 415);
  const form = new FormData(); form.set('id', id); form.set('version', '1'); form.set('physician', new File([JPEG], 'note.jpg', { type: 'application/octet-stream' }));
  await p.ok('documents', { form });
  const booking = (await staff.ok('state')).bookings[0];
  assert.equal(booking.documents[0].contentType, 'image/jpeg');
  const download = await staff.call('document', { query: `?id=${booking.documents[0].id}` });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('content-type'), 'image/jpeg');
  assert.match(download.headers.get('content-security-policy'), /sandbox/);
  assert.deepEqual(new Uint8Array(download.data), JPEG);
  assert.equal((await other.call('document', { query: `?id=${booking.documents[0].id}` })).status, 404);
  await staff.ok('confirm', { body: { id: booking.id, version: booking.version, registrationVersion: 1, registrationChecked: true, room: 'A', group: '呼吸器', medical: true, infection: true, staffing: true } });
  assert.equal((await p.ok('state')).bookings[0].status, 'confirmed');
  await Promise.all(w.tasks);
  const kinds = w.backend.rows.notifications.map(n => `${n.recipient_role}:${n.kind}:${n.status}`);
  assert.ok(kinds.includes('facility:新しい申込み:skipped'));
  assert.ok(kinds.includes('parent:予約確定:skipped'));
});

test('staff invitation: code shown once, used once, operator permissions', async () => {
  const w = world(); const staff = await admin(w);
  const invite = await staff.ok('staff-invite', { body: { name: '看護師 佐藤', email: 'Sato@Example.jp', permission: 'operator' } });
  assert.ok(invite.code.length >= 20);
  const nurse = w.client('staff');
  assert.equal((await nurse.call('activate', { body: { email: 'sato@example.jp', password: 'nurse-password-1', code: 'wrong' } })).status, 401);
  const joined = await nurse.ok('activate', { body: { email: 'sato@example.jp', password: 'nurse-password-1', code: invite.code } });
  assert.equal(joined.state.permission, 'operator');
  assert.equal((await w.client('staff').call('activate', { body: { email: 'sato@example.jp', password: 'nurse-password-2', code: invite.code } })).status, 401);
  assert.equal((await nurse.call('staff-invite', { body: { name: 'x', email: 'x@example.jp', permission: 'admin' } })).status, 403);
  assert.equal((await nurse.call('close-day', { body: { date: '2026-10-05', confirm: true } })).status, 403);
  assert.equal((await nurse.call('backup')).status, 403);
  const s = await staff.ok('state');
  const member = s.staff.find(m => m.email === 'sato@example.jp');
  await staff.ok('staff-membership', { body: { memberId: member.id, version: member.version, permission: 'operator', active: false } });
  const after = await nurse.ok('state');
  assert.deepEqual(after.facilities, []);
  assert.equal(after.bookings, undefined);
  assert.equal((await nurse.call('confirm', { body: {} })).status, 403);
});

test('password reset link signs in and allows a new password', async () => {
  const w = world(); await admin(w); await parent(w);
  const p = w.client('parent');
  await p.ok('reset-request', { body: { email: 'parent@example.jp' } });
  await p.ok('reset-request', { body: { email: 'unknown@example.jp' } }); // same answer
  const link = w.backend.links.find(l => l.type === 'recovery');
  const confirmed = await confirmLink(new Request(`${ORIGIN}/auth/confirm?token_hash=${link.tokenHash}&type=recovery`), w.backend);
  assert.equal(confirmed.location, '/reset?role=parent');
  for (const set of confirmed.cookies) { const [pair] = set.split(';'); const [k, v] = pair.split('='); p.jar.set(k, v); }
  await p.ok('update-password', { body: { password: 'brand-new-password' } });
  const again = await confirmLink(new Request(`${ORIGIN}/auth/confirm?token_hash=${link.tokenHash}&type=recovery`), w.backend);
  assert.match(again.location, /link-invalid/);
  await w.client('parent').ok('login', { body: { email: 'parent@example.jp', password: 'brand-new-password' } });
});

test('CSV export neutralizes spreadsheet formulas and is staff only', async () => {
  const w = world(); const staff = await admin(w);
  const p = await parent(w);
  await p.ok('register-child', { body: { ...profile, name: '=HYPERLINK("x")' } });
  const childId = (await p.ok('state')).children[0].id;
  await p.ok('reserve', { body: { childId, date: '2026-10-05', start: '09:00', end: '15:00', symptom: '発熱', medication: false, agree: true, requestId: crypto.randomUUID() } });
  const csv = await staff.call('export', { query: '?from=2026-10-01&to=2026-10-31' });
  assert.equal(csv.status, 200);
  const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(csv.data);
  assert.ok(text.startsWith('﻿"施設","利用日"'));
  assert.ok(text.includes(`"'=HYPERLINK(""x"")"`));
  assert.equal((await p.call('export', { method: 'GET' })).status, 404);
});

test('expired access token is renewed from the refresh cookie', async () => {
  const w = world(); await admin(w);
  const p = await parent(w);
  p.jar.set('__Host-sy-parent', 'expired-token');
  const before = p.jar.get('__Host-sy-parent-refresh');
  assert.equal((await p.ok('state')).authenticated, true);
  assert.notEqual(p.jar.get('__Host-sy-parent'), 'expired-token');
  assert.notEqual(p.jar.get('__Host-sy-parent-refresh'), before);
  p.jar.set('__Host-sy-parent', 'bad'); p.jar.set('__Host-sy-parent-refresh', 'bad');
  const r = await p.ok('state');
  assert.equal(r.authenticated, false);
  assert.equal(p.jar.size, 0);
});

test('multiple facilities: owner creates, staff are scoped, parents use one account per facility', async () => {
  const w = world(); const owner = await admin(w);
  await owner.ok('facility-create', { body: { id: 'ogaki', name: '病児保育室 大垣', municipality: '大垣市' }, f: '' });
  assert.equal((await owner.call('facility-create', { body: { id: 'ogaki', name: 'x' }, f: '' })).status, 409);
  assert.equal((await owner.call('facility-create', { body: { id: 'Bad ID', name: 'x' }, f: '' })).status, 400);
  const top = await owner.ok('state', { f: '' });
  assert.deepEqual(top.facilities.map(f => f.id).sort(), ['ogaki', 'yoro']);
  // Different house rules per facility.
  const og = await owner.ok('state', { f: 'ogaki' });
  await owner.ok('update-settings', { body: { version: og.settings.version, settings: { ...og.settings, openWeekdays: [1, 2, 3, 4, 5, 6], dailyCapacity: 3 } }, f: 'ogaki' });
  assert.equal((await owner.ok('state', { f: 'ogaki' })).settings.dailyCapacity, 3);
  assert.equal((await owner.ok('state', { f: 'yoro' })).settings.dailyCapacity, 6);
  // A nurse invited to 大垣 only.
  const invite = await owner.ok('staff-invite', { body: { name: '看護師 田中', email: 'tanaka@example.jp', permission: 'admin' }, f: 'ogaki' });
  const nurse = w.client('staff', 'ogaki');
  await nurse.ok('activate', { body: { email: 'tanaka@example.jp', password: 'nurse-password-1', code: invite.code } });
  assert.deepEqual((await nurse.ok('state', { f: '' })).facilities.map(f => f.id), ['ogaki']);
  assert.equal((await nurse.call('update-settings', { body: {}, f: 'yoro' })).status, 403);
  assert.equal((await nurse.call('export', { f: 'yoro' })).status, 403);
  assert.equal((await nurse.call('facility-create', { body: { id: 'x1', name: 'x' }, f: '' })).status, 403);
  // Later invited to 養老 too: joins with the same account.
  const second = await owner.ok('staff-invite', { body: { name: '看護師 田中', email: 'tanaka@example.jp', permission: 'operator' }, f: 'yoro' });
  await nurse.ok('join', { body: { code: second.code }, f: '' });
  assert.deepEqual((await nurse.ok('state', { f: '' })).facilities.map(f => f.id).sort(), ['ogaki', 'yoro']);
  assert.equal((await nurse.ok('state', { f: 'yoro' })).permission, 'operator');
  // One parent account, separate households and bookings per facility.
  const p = await parent(w);
  await p.ok('register-child', { body: profile });
  const pOg = w.client('parent', 'ogaki'); for (const [k, v] of p.jar) pOg.jar.set(k, v);
  const inOgaki = await pOg.ok('state');
  assert.equal(inOgaki.user.complete, false, 'registration is reviewed per facility');
  assert.equal(inOgaki.children.length, 0);
  assert.equal((await owner.ok('state', { f: 'ogaki' })).children.length, 0);
  // Deactivated facility is hidden from parents.
  await owner.ok('facility-active', { body: { id: 'ogaki', active: false }, f: '' });
  assert.equal((await pOg.call('state')).status, 404);
  assert.deepEqual((await w.client('parent', '').ok('facilities')).facilities.map(f => f.id), ['yoro']);
});

test('HQ owners can be invited and see every facility', async () => {
  const w = world(); const owner = await admin(w);
  await owner.ok('facility-create', { body: { id: 'ogaki', name: '大垣' }, f: '' });
  const invite = await owner.ok('owner-invite', { body: { name: '本部 鈴木', email: 'suzuki@example.jp' }, f: '' });
  const hq = w.client('staff', '');
  const joined = await hq.ok('activate', { body: { email: 'suzuki@example.jp', password: 'hq-password-001', code: invite.code } });
  assert.equal(joined.state.owner, true);
  assert.deepEqual(joined.state.facilities.map(f => f.id).sort(), ['ogaki', 'yoro']);
  assert.equal((await hq.ok('state', { f: 'ogaki' })).permission, 'admin');
});
