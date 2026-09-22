// Booking rules and state transitions. Server only.
// Ported from the Support you trial core (lib/simulation.mjs executeBusiness) with the
// fixed trial dates, test clock and synthetic choices replaced by real input.
// Callers resolve the actor from a verified identity and current membership, and run
// every write inside Repository.change so validation, state and audit commit together.
import { at, jstDate, jstTime, addDays, isCalendarDate, regularClosure } from './calendar.mjs';

// Provisional operating rules adopted from the trial (Drive: Support you 仕様書 §7).
// Change here when the facility confirms its formal requirements.
export const RULES = Object.freeze({
  arrivalTimes: ['09:00', '09:30', '10:00'],
  endTimes: ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
  closingTime: '17:00',
  bookingOpensTime: '12:00', // on the previous day
  cancelRequestFrom: '08:30', // on the day of use, for held bookings
  dailyCapacity: 6,
  roomCapacity: 3,
  rooms: ['A', 'B'],
  groups: ['呼吸器', '消化器', 'その他'],
  feeShort: 1000,
  feeLong: 2000,
  feeThresholdMs: 4 * 3600 * 1000,
  childrenPerHousehold: 6,
  listDays: 7,
});

export const TERMINAL = ['cancelled', 'rejected', 'completed'];
export const HOLD = ['confirmed', 'cancel_requested', 'checked_in', 'offer_pending', 'offer_accepted'];
export const STATUSES = {
  pending: '施設の確認待ち', needs_documents: '書類の再提出待ち', waitlisted: 'キャンセル待ち',
  offer_pending: '繰上げの意思確認待ち', offer_accepted: '繰上げ希望・職員の再確認待ち',
  confirmed: '予約確定', cancel_requested: '取消し確認待ち', cancelled: 'キャンセル済み',
  rejected: '受入不可', checked_in: 'お預かり中', completed: '利用終了',
};

export class Fault extends Error { constructor(status, message) { super(message); this.status = status; } }
export const need = (ok, message, status = 400) => { if (!ok) throw new Fault(status, message); };
const uuid = () => crypto.randomUUID();
const hex = buffer => Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
export const sha = async value => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));

export const newState = () => ({ clock: new Date().toISOString(), accounts: [], children: [], bookings: [], audit: [], receipts: [], closed: [], dayCapacity: {}, incidents: [] });
export const audit = (s, actor, event, target) => { s.audit.push({ id: uuid(), at: s.clock, recordedAt: new Date().toISOString(), actor, event, target }); };

// Free text with a length limit. Control characters are removed; line breaks kept when allowed.
export function text(value, label, max, { required = true, multiline = false } = {}) {
  need(value === undefined || value === null || typeof value === 'string', `${label}を確認してください。`);
  const cleaned = String(value ?? '').replace(multiline ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, '').trim();
  need(!required || cleaned.length > 0, `${label}を入力してください。`);
  need(cleaned.length <= max, `${label}は${max}文字以内で入力してください。`);
  return cleaned;
}
const phone = (value, label, required = true) => {
  const v = text(value, label, 20, { required }).replace(/[‐－―ー−]/g, '-').replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
  need(!v || /^[0-9][0-9-]{8,15}$/.test(v), `${label}は数字とハイフンで入力してください。`);
  return v;
};
const chosen = (value, values, label) => { need(values.includes(value), `${label}を選択してください。`); return value; };

export function profile(body, today) {
  const birth = text(body.birth, '生年月日', 10);
  need(isCalendarDate(birth) && birth <= today && birth > addDays(today, -365 * 13 - 4), '生年月日を確認してください。対象は小学生までです。');
  return {
    name: text(body.name, 'お子さまの氏名', 40),
    kana: text(body.kana, 'ふりがな', 40),
    birth,
    guardian: text(body.guardian, '保護者氏名', 40),
    phone: phone(body.phone, '保護者の電話番号'),
    emergencyName: text(body.emergencyName, '緊急連絡先の氏名・続柄', 40),
    emergencyPhone: phone(body.emergencyPhone, '緊急連絡先の電話番号'),
    pickup: text(body.pickup, 'お迎えに来る方', 200, { required: false, multiline: true }),
    allergy: text(body.allergy, 'アレルギー', 200, { multiline: true }),
    history: text(body.history, '既往歴・かかりつけ医', 200, { multiline: true }),
  };
}

export const publicChild = c => ({ id: c.id, name: c.name, kana: c.kana || '', birth: c.birth, guardian: c.guardian, phone: c.phone || '', emergencyName: c.emergencyName || '', emergencyPhone: c.emergencyPhone || '', pickup: c.pickup || '', allergy: c.allergy, history: c.history, status: c.status, version: c.version, reason: c.reason || '' });
export const publicBooking = b => ({ id: b.id, childId: b.childId, date: b.date, start: b.start, end: b.end, symptom: b.symptom, notes: b.notes || '', medication: b.medication, physician: b.physician, medicineDoc: b.medicineDoc, status: b.status, label: STATUSES[b.status], version: b.version, reason: b.reason || '', messages: b.messages, events: b.events, fee: b.fee ?? null, pickup: b.pickup || '', checkedInAt: b.checkedInAt || null, completedAt: b.completedAt || null });

export const capacityOf = (s, date) => s.dayCapacity?.[date] ?? RULES.dailyCapacity;
export const closureOf = (s, date) => s.closed.includes(date) ? '施設の休園日' : regularClosure(date);

export function availability(s, date) {
  const now = Date.parse(s.clock);
  if (closureOf(s, date)) return '休園';
  if (date < jstDate(s.clock)) return '受付終了';
  if (now < at(date, RULES.bookingOpensTime) - 86400000) return '受付開始前';
  if (now >= at(date, RULES.closingTime) || !RULES.arrivalTimes.some(start => at(date, start) >= now)) return '受付終了';
  if (s.bookings.filter(b => b.date === date && HOLD.includes(b.status)).length >= capacityOf(s, date)) return 'キャンセル待ち';
  return '予約可';
}
export const availabilityList = s => Array.from({ length: RULES.listDays }, (_, i) => {
  const date = addDays(jstDate(s.clock), i);
  return { date, status: availability(s, date), closure: closureOf(s, date) };
});

function ownChild(s, user, childId) { const c = s.children.find(c => c.id === childId && (user.role === 'staff' || c.owner === user.id)); need(c, '対象の登録が見つかりません。', 404); return c; }
function ownBooking(s, user, bookingId) { const b = s.bookings.find(b => b.id === bookingId && (user.role === 'staff' || b.owner === user.id)); need(b, '対象の予約が見つかりません。', 404); return b; }
function revised(record, version) { need(Number.isInteger(version) && record.version === version, '情報が更新されています。最新の内容を読み直してください。', 409); }
export function event(s, b, label) { b.version++; if (b.status !== 'offer_pending') b.offerExpiresAt = null; b.events.push({ at: s.clock, label }); }
const release = b => { b.room = null; b.group = null; };

export async function executeBusiness(s, user, path, body) {
  const role = user.role;
  need(role === 'parent' || role === 'staff', '操作権限を確認できません。', 403);
  const today = jstDate(s.clock);
  if (role === 'parent') {
    if (path === 'register-child') {
      need(body.consent === true && body.emergencyConsent === true, '利用条件と緊急時連絡の確認が必要です。');
      need(s.children.filter(c => c.owner === user.id).length < RULES.childrenPerHousehold, `1家庭${RULES.childrenPerHousehold}名まで登録できます。`);
      const p = profile(body, today);
      need(!s.children.some(c => c.owner === user.id && c.name === p.name && c.birth === p.birth), '同じお子さまが登録されています。', 409);
      const child = { ...p, id: uuid(), owner: user.id, status: 'pending', version: 1 };
      s.children.push(child);
      s.accounts.find(a => a.id === user.id).complete = true;
      audit(s, user.id, '利用者情報登録', child.id);
      return { ok: true, id: child.id };
    }
    need(user.complete, '先に利用者登録を完了してください。', 403);
    if (path === 'edit-child') {
      need(body.consent === true && body.emergencyConsent === true, '利用条件と緊急時連絡を改めて確認してください。');
      const c = ownChild(s, user, body.id); revised(c, body.version);
      need(!s.bookings.some(b => b.childId === c.id && ['checked_in', 'cancel_requested'].includes(b.status)), 'お預かり中・取消し確認中の変更は施設へご連絡ください。', 409);
      const updated = profile(body, today);
      need(!s.children.some(x => x.id !== c.id && x.owner === user.id && x.name === updated.name && x.birth === updated.birth), '同じお子さまが登録されています。', 409);
      Object.assign(c, updated, { status: 'pending', version: c.version + 1, reason: '' });
      for (const b of s.bookings.filter(b => b.childId === c.id && !TERMINAL.includes(b.status))) { b.status = b.needsOfferConsent ? 'waitlisted' : 'pending'; release(b); event(s, b, '利用者情報変更のため再確認待ち'); }
      audit(s, user.id, '利用者情報変更', c.id);
      return { ok: true };
    }
    if (path === 'reserve') {
      const c = ownChild(s, user, body.childId);
      need(/^[0-9a-f-]{36}$/.test(body.requestId || ''), '送信番号が無効です。画面を読み直してください。');
      const fingerprint = await sha(JSON.stringify([body.childId, body.date, body.start, body.end, body.symptom, body.notes || '', body.medication, body.agree]));
      const receipt = s.receipts.find(r => r.owner === user.id && r.key === body.requestId);
      if (receipt) { need(receipt.fingerprint === fingerprint, '同じ送信番号で入力内容が変更されています。新しい申込みとして確認してください。', 409); return { ok: true, id: receipt.id, repeated: true }; }
      need(isCalendarDate(body.date), '利用日を選択してください。');
      const open = availability(s, body.date);
      need(['予約可', 'キャンセル待ち'].includes(open), `現在、この日は受付できません（${open}）。`, 409);
      need(!s.bookings.some(b => b.childId === c.id && b.date === body.date && !['cancelled', 'rejected'].includes(b.status)), '同じお子さま・同じ日の予約があります。', 409);
      need(RULES.arrivalTimes.includes(body.start) && RULES.endTimes.includes(body.end) && body.end > body.start, '利用時刻を確認してください。');
      need(at(body.date, body.start) >= Date.parse(s.clock), '来園予定時刻を過ぎています。施設へお電話ください。', 409);
      need(body.agree === true, '申込みは予約確定ではないことを確認してください。');
      const symptom = text(body.symptom, '症状', 200, { multiline: true });
      const notes = text(body.notes, '連絡事項', 500, { required: false, multiline: true });
      need(typeof body.medication === 'boolean', '服薬の有無を選択してください。');
      const b = { id: uuid(), owner: user.id, childId: c.id, date: body.date, start: body.start, end: body.end, symptom, notes, medication: body.medication, physician: false, medicineDoc: false, status: open === 'キャンセル待ち' ? 'waitlisted' : 'pending', version: 1, messages: [], events: [{ at: s.clock, label: '申込み受付（未確定）' }], createdAt: s.clock };
      b.needsOfferConsent = b.status === 'waitlisted';
      s.bookings.push(b);
      s.receipts.push({ owner: user.id, key: body.requestId, id: b.id, fingerprint, at: s.clock });
      audit(s, user.id, '予約申込み', b.id);
      return { ok: true, id: b.id, status: b.status };
    }
    const b = ownBooking(s, user, body.id); revised(b, body.version);
    if (path === 'documents') {
      need(['pending', 'needs_documents', 'waitlisted', 'confirmed', 'offer_accepted'].includes(b.status), 'この状態では書類を変更できません。', 409);
      need(body.physician === true, '医師連絡票を添付してください。');
      need(!b.medication || body.medicineDoc === true, '服薬ありの場合、与薬依頼書も必要です。');
      b.physician = true; b.medicineDoc = b.medication;
      const wasConfirmed = b.status === 'confirmed';
      if (b.needsOfferConsent) b.status = 'waitlisted'; else if (b.status !== 'waitlisted') b.status = 'pending';
      release(b); b.reason = '';
      event(s, b, wasConfirmed ? '書類差替え・確定を解除して再確認待ち' : '必要書類を提出');
      audit(s, user.id, '書類提出', b.id);
      return { ok: true };
    }
    if (path === 'cancel') {
      need(!TERMINAL.includes(b.status) && !['checked_in', 'cancel_requested'].includes(b.status), 'この状態ではキャンセルできません。', 409);
      if (Date.parse(s.clock) >= at(b.date, RULES.cancelRequestFrom) && HOLD.includes(b.status)) b.status = 'cancel_requested';
      else { b.status = 'cancelled'; release(b); }
      event(s, b, STATUSES[b.status]);
      audit(s, user.id, 'キャンセル申出', b.id);
      return { ok: true, status: b.status };
    }
    if (path === 'message') {
      need(!TERMINAL.includes(b.status), '終了した予約には送信できません。', 409);
      b.messages.push({ id: uuid(), at: s.clock, from: '保護者', text: text(body.message, '連絡内容', 500, { multiline: true }) });
      event(s, b, '保護者からの連絡');
      audit(s, user.id, '連絡', b.id);
      return { ok: true };
    }
  } else {
    if (path === 'registration') {
      const c = ownChild(s, user, body.id); revised(c, body.version);
      need(['approved', 'returned'].includes(body.status), '操作が不正です。');
      if (body.status === 'returned') {
        c.reason = text(body.reason, '差戻し理由', 500, { multiline: true });
        for (const b of s.bookings.filter(b => b.childId === c.id && !TERMINAL.includes(b.status))) {
          need(!['checked_in', 'cancel_requested'].includes(b.status), 'お預かり中・取消し確認中の登録は差戻しできません。', 409);
          b.status = b.needsOfferConsent ? 'waitlisted' : 'pending'; release(b); event(s, b, '利用者登録の再確認が必要');
        }
      } else { need(body.checked === true, '利用者情報・緊急連絡先を確認してください。'); c.reason = ''; }
      c.status = body.status; c.version++;
      audit(s, user.id, body.status === 'approved' ? '利用者登録を承認' : '利用者登録を差戻し', c.id);
      return { ok: true, owner: c.owner };
    }
    const b = ownBooking(s, user, body.id); revised(b, body.version);
    if (path === 'confirm') {
      need(['pending', 'waitlisted', 'offer_accepted'].includes(b.status), 'この状態では確定できません。', 409);
      const child = ownChild(s, user, b.childId);
      if (child.status !== 'approved') {
        need(child.status === 'pending', '利用者情報の修正完了を待っています。', 409);
        revised(child, body.registrationVersion);
        need(body.registrationChecked === true, '利用者情報・緊急連絡先・対象条件を確認してください。');
      }
      need(b.physician && (!b.medication || b.medicineDoc), '必要書類が揃っていません。', 409);
      need(body.medical === true && body.infection === true && body.staffing === true, '医師連絡票・感染区分・職員体制をすべて確認してください。');
      need(!closureOf(s, b.date), '休園日の予約は確定できません。', 409);
      need(at(b.date, b.end) > Date.parse(s.clock), '利用予定が終了しています。', 409);
      const room = chosen(body.room, RULES.rooms, '保育室'), group = chosen(body.group, RULES.groups, '感染区分');
      const held = s.bookings.filter(x => x.id !== b.id && x.date === b.date && HOLD.includes(x.status));
      need(held.length < capacityOf(s, b.date), '当日の定員に達しています。', 409);
      const occupants = held.filter(x => x.room === room);
      need(occupants.length < RULES.roomCapacity, '選択した保育室は定員に達しています。', 409);
      need(occupants.every(x => x.group === group), '異なる感染区分を同じ保育室に配置できません。', 409);
      if (child.status !== 'approved') { child.status = 'approved'; child.reason = ''; child.version++; audit(s, user.id, '予約審査時に利用者情報を承認', child.id); }
      b.status = 'confirmed'; b.room = room; b.group = group; b.reason = '';
      event(s, b, '職員確認・予約確定');
      audit(s, user.id, '予約承認・確定', b.id);
      return { ok: true };
    }
    if (path === 'return-documents' || path === 'reject') {
      need(['pending', 'needs_documents', 'waitlisted', 'confirmed', 'offer_pending', 'offer_accepted'].includes(b.status), 'この状態では変更できません。', 409);
      b.reason = text(body.reason, '理由', 500, { multiline: true });
      b.status = path === 'reject' ? 'rejected' : 'needs_documents';
      if (path === 'return-documents') { b.physician = false; b.medicineDoc = false; }
      release(b); event(s, b, STATUSES[b.status]);
      audit(s, user.id, STATUSES[b.status], b.id);
      return { ok: true };
    }
    if (path === 'accept-cancel') {
      need(b.status === 'cancel_requested', '取消し確認待ちの予約ではありません。', 409);
      b.status = 'cancelled'; release(b); event(s, b, '職員が取消しを確認');
      audit(s, user.id, '取消し確認', b.id);
      return { ok: true };
    }
    if (path === 'check-in') {
      need(b.status === 'confirmed' && !closureOf(s, b.date) && b.date === today && jstTime(s.clock) >= addMinutes(b.start, -30) && jstTime(s.clock) < b.end, '休園日以外の利用当日・予約時間内（来園予定の30分前から）・確定済みの場合に受付できます。', 409);
      need(body.checked === true, '本人・当日の状態・持参物の確認が必要です。');
      b.status = 'checked_in'; b.checkedInAt = s.clock; event(s, b, '入室');
      audit(s, user.id, '入室', b.id);
      return { ok: true };
    }
    if (path === 'complete') {
      need(b.status === 'checked_in', 'お預かり中の予約ではありません。', 409);
      need(body.checked === true, 'お迎えの方の本人確認が必要です。');
      need(Date.parse(s.clock) > Date.parse(b.checkedInAt), '退室時刻は入室時刻より後にしてください。', 409);
      b.pickup = text(body.pickup, 'お迎えの方', 40, { required: false }) || ownChild(s, user, b.childId).guardian;
      b.completedAt = s.clock;
      b.fee = Date.parse(s.clock) - Date.parse(b.checkedInAt) <= RULES.feeThresholdMs ? RULES.feeShort : RULES.feeLong;
      b.status = 'completed';
      event(s, b, '本人確認・退室（減免前の利用料金を記録）');
      audit(s, user.id, '退室', b.id);
      return { ok: true };
    }
    if (path === 'message') {
      need(!TERMINAL.includes(b.status), '終了した予約には送信できません。', 409);
      b.messages.push({ id: uuid(), at: s.clock, from: '施設', text: text(body.message, '連絡内容', 500, { multiline: true }) });
      event(s, b, '施設からの連絡');
      audit(s, user.id, '連絡', b.id);
      return { ok: true };
    }
  }
  throw new Fault(404, '操作が見つかりません。');
}

function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number), total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
