// Per-facility house rules. Municipalities decide these differently, so every facility
// keeps its own copy in its aggregate (s.settings), edited by that facility's admins.
// Safe for the browser (no server imports): the settings form reuses the same checks.

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export const DEFAULT_SETTINGS = Object.freeze({
  version: 1,
  profile: { name: '', phone: '', address: '', email: '', municipality: '' },
  openWeekdays: [1, 2, 3, 4, 5],
  closeOnHolidays: true,
  yearEndClosure: { enabled: true, from: '12-29', to: '01-03' },
  arrivalTimes: ['09:00', '09:30', '10:00'],
  endTimes: ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
  bookingOpens: { daysBefore: 1, time: '12:00' },
  bookingDeadline: { daysBefore: 0, time: '10:00' },
  cancelRequestFrom: { daysBefore: 0, time: '08:30' },
  checkInEarlyMinutes: 30,
  dailyCapacity: 6,
  rooms: [{ name: 'A', capacity: 3 }, { name: 'B', capacity: 3 }],
  groups: ['呼吸器', '消化器', 'その他'],
  separateGroups: true,
  fees: [{ maxHours: 4, amount: 1000 }, { maxHours: null, amount: 2000 }],
  feeNote: '減免制度があります。詳しくは施設へお問い合わせください。',
  ageMinMonths: 6,
  ageMaxYears: 12,
  requireMedicineDoc: true,
  waitlist: true,
  eligibilityNote: '',
  guideNote: '',
  listDays: 7,
});

export class SettingsError extends Error { constructor(message) { super(message); this.status = 400; } }
const fail = message => { throw new SettingsError(message); };
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const str = (v, label, max, required = false) => {
  if (v !== undefined && v !== null && typeof v !== 'string') fail(`${label}を確認してください。`);
  const s = String(v ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim();
  if (required && !s) fail(`${label}を入力してください。`);
  if (s.length > max) fail(`${label}は${max}文字以内で入力してください。`);
  return s;
};
const int = (v, label, min, max) => { const n = Number(v); if (!Number.isInteger(n) || n < min || n > max) fail(`${label}は${min}〜${max}の整数で入力してください。`); return n; };
const times = (v, label) => {
  const list = Array.isArray(v) ? v : String(v ?? '').split(/[,、\s]+/);
  const out = [...new Set(list.map(x => String(x).trim()).filter(Boolean))].sort();
  if (!out.length || out.length > 24 || !out.every(t => TIME.test(t))) fail(`${label}は「09:00」の形式で1つ以上入力してください。`);
  return out;
};
const moment = (v, label) => ({ daysBefore: int(v?.daysBefore, `${label}（何日前）`, 0, 30), time: TIME.test(v?.time || '') ? v.time : fail(`${label}の時刻を確認してください。`) });

// Returns a complete, normalized settings object or throws SettingsError.
export function validateSettings(input, previous = DEFAULT_SETTINGS) {
  const v = { ...previous, ...(input || {}) };
  const profile = {
    name: str(v.profile?.name, '施設名', 60, true),
    phone: str(v.profile?.phone, '電話番号', 20),
    address: str(v.profile?.address, '住所', 120),
    email: str(v.profile?.email, '施設の通知先メール', 254),
    municipality: str(v.profile?.municipality, '市町村', 40),
  };
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(profile.email)) fail('施設の通知先メールを確認してください。');
  const openWeekdays = [...new Set((Array.isArray(v.openWeekdays) ? v.openWeekdays : []).map(Number))].filter(d => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  if (!openWeekdays.length) fail('開所する曜日を1つ以上選んでください。');
  const yearEnd = v.yearEndClosure || {};
  const yearEndClosure = { enabled: yearEnd.enabled === true, from: MMDD.test(yearEnd.from || '') ? yearEnd.from : fail('年末年始休園の開始日（12-29の形式）を確認してください。'), to: MMDD.test(yearEnd.to || '') ? yearEnd.to : fail('年末年始休園の終了日（01-03の形式）を確認してください。') };
  const arrivalTimes = times(v.arrivalTimes, '来園時刻');
  const endTimes = times(v.endTimes, 'お迎え時刻');
  if (endTimes[endTimes.length - 1] <= arrivalTimes[0]) fail('お迎え時刻は来園時刻より後にしてください。');
  const rooms = (Array.isArray(v.rooms) ? v.rooms : []).map((r, i) => ({ name: str(r?.name, `保育室${i + 1}の名前`, 20, true), capacity: int(r?.capacity, `保育室${i + 1}の定員`, 1, 20) }));
  if (!rooms.length || rooms.length > 10) fail('保育室を1〜10室設定してください。');
  if (new Set(rooms.map(r => r.name)).size !== rooms.length) fail('保育室の名前が重複しています。');
  const groups = [...new Set((Array.isArray(v.groups) ? v.groups : String(v.groups ?? '').split(/[,、\n]+/)).map(g => str(g, '感染区分', 20)).filter(Boolean))];
  if (!groups.length || groups.length > 12) fail('感染区分を1〜12個設定してください。');
  const dailyCapacity = int(v.dailyCapacity, '1日の定員', 1, 60);
  if (dailyCapacity > rooms.reduce((sum, r) => sum + r.capacity, 0)) fail('1日の定員が保育室の定員の合計を超えています。');
  const fees = (Array.isArray(v.fees) ? v.fees : []).map((f, i) => ({ maxHours: f?.maxHours === null || f?.maxHours === '' || f?.maxHours === undefined ? null : int(f.maxHours, `料金${i + 1}の時間`, 1, 24), amount: int(f?.amount, `料金${i + 1}の金額`, 0, 100000) }))
    .sort((a, b) => (a.maxHours ?? 99) - (b.maxHours ?? 99));
  if (!fees.length || fees[fees.length - 1].maxHours !== null) fail('料金は最後に「それ以上」の段階を含めてください。');
  if (fees.filter(f => f.maxHours === null).length !== 1) fail('「それ以上」の料金は1つだけにしてください。');
  const ageMinMonths = int(v.ageMinMonths, '対象年齢（下限・月齢）', 0, 72);
  const ageMaxYears = int(v.ageMaxYears, '対象年齢（上限・歳）', 1, 18);
  if (ageMinMonths >= ageMaxYears * 12 + 12) fail('対象年齢の下限と上限を確認してください。');
  return {
    version: (previous?.version || 0) + (previous === DEFAULT_SETTINGS ? 0 : 1),
    profile, openWeekdays, closeOnHolidays: v.closeOnHolidays === true, yearEndClosure, arrivalTimes, endTimes,
    bookingOpens: moment(v.bookingOpens, '受付開始'), bookingDeadline: moment(v.bookingDeadline, '受付締切'), cancelRequestFrom: moment(v.cancelRequestFrom, 'キャンセルに施設確認が必要になる時点'),
    checkInEarlyMinutes: int(v.checkInEarlyMinutes, '早めの入室を認める分数', 0, 120),
    dailyCapacity, rooms, groups, separateGroups: v.separateGroups === true, fees,
    feeNote: str(v.feeNote, '料金の補足', 300), ageMinMonths, ageMaxYears,
    requireMedicineDoc: v.requireMedicineDoc === true, waitlist: v.waitlist === true,
    eligibilityNote: str(v.eligibilityNote, '利用条件', 500), guideNote: str(v.guideNote, 'ご利用案内の補足', 2000),
    listDays: int(v.listDays, '表示する日数', 3, 31),
  };
}

export const closingTime = s => s.endTimes[s.endTimes.length - 1];
export function feeFor(s, ms) {
  for (const tier of s.fees) if (tier.maxHours === null || ms <= tier.maxHours * 3600_000) return tier.amount;
  return s.fees[s.fees.length - 1].amount;
}
export function hoursText(s) {
  const days = s.openWeekdays.map(d => WEEKDAYS[d]).join('・');
  const closed = [s.closeOnHolidays && '祝日', s.yearEndClosure.enabled && `年末年始（${s.yearEndClosure.from.replace('-', '/')}〜${s.yearEndClosure.to.replace('-', '/')}）`].filter(Boolean).join('・');
  return `${days}曜 ${s.arrivalTimes[0]}〜${closingTime(s)}${closed ? `（${closed}は休園）` : ''}`;
}
export function feeText(s) {
  let from = 0;
  return s.fees.map(f => { const text = f.maxHours === null ? `${from}時間を超える場合 ${f.amount.toLocaleString()}円` : `${from ? `${from}時間超〜` : ''}${f.maxHours}時間以内 ${f.amount.toLocaleString()}円`; from = f.maxHours ?? from; return text; }).join('、');
}
export function momentText(m, what) { return `${m.daysBefore === 0 ? '当日' : m.daysBefore === 1 ? '前日' : `${m.daysBefore}日前`}の${m.time}${what}`; }
export function ageText(s) { return `${s.ageMinMonths >= 12 && s.ageMinMonths % 12 === 0 ? `${s.ageMinMonths / 12}歳` : `生後${s.ageMinMonths}か月`}〜${s.ageMaxYears}歳`; }
