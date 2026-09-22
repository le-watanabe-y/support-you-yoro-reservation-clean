// Browser-facing API. Framework independent: takes a Request and returns a Response.
// - Sessions live only in HttpOnly __Host- cookies; tokens never reach page scripts.
// - Every POST must come from this origin with the x-supportyou-request header (CSRF).
// - Identity (subject) always comes from the auth provider, never from the request body.
import { Fault, STATUSES, sha } from '../rules.mjs';
import { COMMANDS, DOCUMENT_KINDS } from '../facility-service.mjs';
import { publicBooking } from '../rules.mjs';
import { jstDate, isCalendarDate, addDays } from '../calendar.mjs';
import { sniffDocument, inlineTypes, MAX_DOCUMENT_BYTES } from './documents.mjs';
import { sendMail, mailConfigured, parentMessage, facilityMessage, inviteMessage } from './notify.mjs';

const GET_ACTIONS = { parent: ['state', 'document'], staff: ['state', 'document', 'export', 'backup'] };
const PUBLIC_ACTIONS = { parent: ['signup', 'login', 'reset-request', 'logout'], staff: ['login', 'setup', 'activate', 'reset-request', 'logout'] };
const SESSION_ACTIONS = {
  parent: ['documents', 'update-password', ...COMMANDS.parent],
  staff: ['update-password', 'staff-membership', 'staff-invite', 'staff-invite-revoke', 'orphan-scan', 'orphan-cleanup', ...COMMANDS.staff],
};
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const PASSWORD_HINT = 'パスワードは10〜72文字で入力してください。';

const baseHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
const cookieName = role => `__Host-sy-${role}`;
const refreshAge = role => (role === 'parent' ? 30 * 86400 : 12 * 3600);
export function sessionCookies(role, session) {
  return [
    `${cookieName(role)}=${session.accessToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.min(3600, Math.max(60, Number(session.expiresIn) || 3600))}`,
    `${cookieName(role)}-refresh=${session.refreshToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${refreshAge(role)}`,
  ];
}
const clearCookies = role => [`${cookieName(role)}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`, `${cookieName(role)}-refresh=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`];
function readCookies(request, role) {
  const all = (request.headers.get('cookie') || '').split(';').map(x => x.trim());
  const find = name => all.find(x => x.startsWith(name + '='))?.slice(name.length + 1) || '';
  return { token: find(cookieName(role)), refreshToken: find(cookieName(role) + '-refresh') };
}
const email = value => { const v = String(value || '').trim().toLowerCase(); if (!EMAIL.test(v) || v.length > 254) throw new Fault(400, 'メールアドレスを確認してください。'); return v; };
const password = value => { if (typeof value !== 'string' || value.length < 10 || new TextEncoder().encode(value).length > 72) throw new Fault(400, PASSWORD_HINT); return value; };
const randomCode = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
function safeEqual(a, b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }
const clientIp = request => (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';

export async function handleApi(request, { role, action, backend, env = process.env, defer = fn => { void fn(); } }) {
  const requestId = crypto.randomUUID(), url = new URL(request.url), origin = env.SUPPORTYOU_SITE_URL?.replace(/\/$/, '') || url.origin;
  let subject = null, extraCookies = [];
  const finish = (response, status) => {
    for (const c of extraCookies) response.headers.append('Set-Cookie', c);
    defer(() => backend.logEvent({ request_id: requestId, subject, operation: `${role}:${action}`.slice(0, 60), result: status }).catch(() => {}));
    return response;
  };
  try {
    if (!['parent', 'staff'].includes(role)) throw new Fault(404, '操作が見つかりません。');
    const isGet = GET_ACTIONS[role].includes(action);
    if (!isGet && !PUBLIC_ACTIONS[role].includes(action) && !SESSION_ACTIONS[role].includes(action)) throw new Fault(404, '操作が見つかりません。');
    if (request.method !== (isGet ? 'GET' : 'POST')) throw new Fault(405, '操作方法が一致しません。');
    let body = {}, form = null;
    if (!isGet) {
      const requestOrigin = request.headers.get('origin');
      if (requestOrigin !== url.origin && requestOrigin !== origin || request.headers.get('x-supportyou-request') !== '1') throw new Fault(403, '画面を開き直して操作してください。');
      const type = request.headers.get('content-type') || '';
      if (action === 'documents') {
        if (!type.startsWith('multipart/form-data')) throw new Fault(415, '書類の送信形式が不正です。');
        if (Number(request.headers.get('content-length') || 0) > 2 * MAX_DOCUMENT_BYTES + 100_000) throw new Fault(413, 'ファイルが大きすぎます。1ファイル4MBまでです。');
        form = await request.formData();
      } else {
        if (!type.startsWith('application/json')) throw new Fault(415, 'JSON形式で送信してください。');
        const raw = await request.text();
        if (raw.length > 16000) throw new Fault(413, '入力が長すぎます。');
        try { body = JSON.parse(raw || '{}'); } catch { throw new Fault(400, '入力内容を読み取れません。'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Fault(400, '入力内容を読み取れません。');
      }
    }
    const cookies = readCookies(request, role);
    if (cookies.token.length > 8000 || cookies.refreshToken.length > 4000) { extraCookies = clearCookies(role); throw Object.assign(new Fault(401, 'もう一度ログインしてください。'), { code: 'SESSION_INVALID' }); }

    // ---- Actions without a session ----
    if (action === 'state' && !cookies.token && !cookies.refreshToken) return finish(json({ authenticated: false, ...(role === 'staff' ? { setupAvailable: !(await backend.config.get()).bootstrap_subject } : {}) }), 200);
    if (action === 'logout') {
      if (cookies.token) await backend.auth.signOut(cookies.token).catch(() => {});
      extraCookies = clearCookies(role);
      return finish(json({ ok: true }), 200);
    }
    if (action === 'signup') {
      const address = email(body.email), secret = password(body.password);
      if (body.consent !== true) throw new Fault(400, '利用規約と個人情報の取扱いへの同意が必要です。');
      await limit(backend, [`signup:${await sha(address)}`, 5], [`signup-ip:${clientIp(request)}`, 20]);
      const result = await backend.auth.signUp({ email: address, password: secret, redirectTo: `${origin}/auth/confirm` });
      if (!result.session) return finish(json({ ok: true, confirmationRequired: true }), 200);
      const signedIn = await backend.auth.signIn({ email: address, password: secret });
      subject = signedIn.subject;
      await ensureParent(backend, signedIn.subject, address);
      extraCookies = sessionCookies('parent', signedIn.session);
      return finish(json({ ok: true, state: await stateFor(backend, 'parent', signedIn.subject, address) }), 200);
    }
    if (action === 'login') {
      const address = email(body.email);
      if (typeof body.password !== 'string' || body.password.length > 200) throw new Fault(401, 'メールアドレスまたはパスワードが一致しません。');
      await limit(backend, [`login:${await sha(address)}`, 10], [`login-ip:${clientIp(request)}`, 60]);
      const signedIn = await backend.auth.signIn({ email: address, password: body.password });
      subject = signedIn.subject;
      const identity = role === 'parent' ? await ensureParent(backend, signedIn.subject, address) : await backend.identities.get(signedIn.subject);
      if (!identity || identity.kind !== role || identity.blocked) {
        await backend.auth.signOut(signedIn.session.accessToken).catch(() => {});
        throw new Fault(403, role === 'staff' ? '職員用アカウントではありません。保護者の方は保護者用ページからログインしてください。' : 'このアカウントは職員用です。職員画面からログインしてください。');
      }
      const state = await stateFor(backend, role, signedIn.subject, address);
      extraCookies = sessionCookies(role, signedIn.session);
      return finish(json({ ok: true, state }), 200);
    }
    if (action === 'reset-request') {
      const address = email(body.email);
      await limit(backend, [`reset:${await sha(address)}`, 5], [`reset-ip:${clientIp(request)}`, 20]);
      await backend.auth.requestPasswordReset(address, `${origin}/auth/confirm`);
      return finish(json({ ok: true }), 200); // Same answer whether or not the address exists.
    }
    if (action === 'setup') {
      // First administrator. Requires the deploy-time setup code, only while none exists.
      const code = env.SUPPORTYOU_SETUP_CODE || '';
      await limit(backend, [`setup-ip:${clientIp(request)}`, 10]);
      if (code.length < 16 || !safeEqual(String(body.setupCode || ''), code)) throw new Fault(403, '初期設定コードが一致しません。');
      if ((await backend.config.get()).bootstrap_subject) throw new Fault(409, '初期管理者は登録済みです。ログインしてください。');
      const address = email(body.email), secret = password(body.password), name = String(body.name || '').trim().slice(0, 40) || '管理者';
      const created = await backend.auth.createConfirmedUser({ email: address, password: secret });
      subject = created.subject;
      try {
        await backend.identities.insert({ subject, email: address, kind: 'staff' });
        await backend.service.bootstrapAdmin(subject, { name, email: address });
        await backend.config.setBootstrap(subject);
      } catch (error) { await backend.auth.deleteUser(subject).catch(() => {}); throw error; }
      const signedIn = await backend.auth.signIn({ email: address, password: secret });
      extraCookies = sessionCookies('staff', signedIn.session);
      return finish(json({ ok: true, state: await stateFor(backend, 'staff', subject, address) }), 200);
    }
    if (action === 'activate') {
      const address = email(body.email), secret = password(body.password);
      await limit(backend, [`activate:${await sha(address)}`, 10], [`activate-ip:${clientIp(request)}`, 30]);
      const invite = await backend.invites.verify(address, await sha(String(body.code || '').trim()));
      if (!invite) throw new Fault(401, 'メールアドレスまたは招待コードが一致しないか、有効期限が切れています。');
      const created = await backend.auth.createConfirmedUser({ email: address, password: secret });
      subject = created.subject;
      try {
        await backend.identities.insert({ subject, email: address, kind: 'staff' });
        await backend.service.acceptStaffInvitation(subject, { permission: invite.permission, name: invite.name, email: address, invitationId: invite.invite_id });
      } catch (error) { await backend.auth.deleteUser(subject).catch(() => {}); throw error; }
      await backend.invites.markUsed(invite.invite_id, subject);
      const signedIn = await backend.auth.signIn({ email: address, password: secret });
      extraCookies = sessionCookies('staff', signedIn.session);
      return finish(json({ ok: true, state: await stateFor(backend, 'staff', subject, address) }), 200);
    }

    // ---- Actions with a session ----
    let session;
    try { session = await backend.auth.resolve(cookies); }
    catch (error) { if (error.code === 'SESSION_INVALID') { extraCookies = clearCookies(role); if (action === 'state') return finish(json({ authenticated: false, code: 'SESSION_INVALID' }), 200); } throw error; }
    subject = session.subject;
    if (session.renewed) extraCookies = sessionCookies(role, session.renewed);
    const identity = role === 'parent' ? await ensureParent(backend, subject, session.email) : await backend.identities.get(subject);
    if (!identity || identity.kind !== role || identity.blocked) throw new Fault(403, role === 'staff' ? 'この画面の利用権限がありません。' : 'このアカウントは職員用です。職員画面をご利用ください。');
    const service = backend.service;

    if (action === 'state') return finish(json(await stateFor(backend, role, subject, session.email)), 200);
    if (action === 'update-password') {
      await backend.auth.setPassword(subject, password(body.password));
      return finish(json({ ok: true }), 200);
    }
    if (action === 'document') {
      const doc = await service.readDocument(subject, role, url.searchParams.get('id') || '');
      const headers = { ...baseHeaders, 'Content-Type': doc.contentType, 'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; plugin-types application/pdf; sandbox", 'Content-Disposition': `${inlineTypes.has(doc.contentType) ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(doc.name)}` };
      return finish(new Response(doc.bytes, { status: 200, headers }), 200);
    }
    if (action === 'documents') {
      const files = [];
      for (const kind of Object.keys(DOCUMENT_KINDS)) {
        const file = form.get(kind);
        if (!file || typeof file === 'string' || file.size === 0) continue;
        if (file.size > MAX_DOCUMENT_BYTES) throw new Fault(413, `${DOCUMENT_KINDS[kind]}のファイルが大きすぎます（4MBまで）。写真の場合は画面から撮り直してください。`);
        const bytes = new Uint8Array(await file.arrayBuffer()), type = sniffDocument(bytes);
        if (!type) throw new Fault(415, `${DOCUMENT_KINDS[kind]}は写真（JPEG・PNG・HEIC）またはPDFで提出してください。`);
        files.push({ kind, bytes, contentType: type.contentType, ext: type.ext });
      }
      const result = await service.submitDocuments(subject, { id: String(form.get('id') || ''), version: Number(form.get('version')), files });
      defer(() => notifyFacility(backend, env, origin, String(form.get('id')), '書類の提出'));
      return finish(json(result), 200);
    }
    if (action === 'staff-membership') {
      const result = await service.staffMembership(subject, body);
      return finish(json(result), 200);
    }
    if (action === 'staff-invite' || action === 'staff-invite-revoke') {
      const s = await service.state(); service.staffAdmin(s, subject);
      if (action === 'staff-invite-revoke') {
        if (!await backend.invites.revoke(String(body.id || ''))) throw new Fault(409, '招待は使用済み、取消し済み、または見つかりません。');
        return finish(json({ ok: true }), 200);
      }
      const address = email(body.email), name = String(body.name || '').trim().slice(0, 40);
      if (!name) throw new Fault(400, '職員の氏名を入力してください。');
      if (!['admin', 'operator'].includes(body.permission)) throw new Fault(400, '権限を選択してください。');
      if (s.memberships.some(m => m.role === 'staff' && m.email === address)) throw new Fault(409, 'この職員は登録済みです。');
      const code = randomCode();
      const row = await backend.invites.create({ email: address, name, permission: body.permission, code_hash: await sha(code), expires_at: new Date(Date.now() + 72 * 3600_000).toISOString(), created_by: subject });
      const mailed = body.sendEmail === true && mailConfigured(env) ? await sendMail({ to: address, ...inviteMessage({ name, code, origin, expiresAt: row.expires_at }) }, env) : { status: 'skipped' };
      await backend.recordNotification({ kind: 'staff-invite', recipient_role: 'staff', status: mailed.status, error: mailed.error || null }).catch(() => {});
      return finish(json({ ok: true, code, expiresAt: row.expires_at, mailed: mailed.status === 'sent' }), 200);
    }
    if (action === 'orphan-scan' || action === 'orphan-cleanup') {
      const s = await service.state(); service.staffAdmin(s, subject);
      const referenced = new Set((s.documentVersions || []).map(d => d.key));
      const archived = await backend.repo.listArchivedBookings({});
      for (const row of archived) for (const d of row.data?.documents || []) referenced.add(d.key);
      const orphanKeys = (await backend.documents.listAll()).filter(key => !referenced.has(key));
      await backend.orphans.record(orphanKeys, subject);
      const tracked = await backend.orphans.quarantined();
      await backend.orphans.mark(tracked.filter(r => referenced.has(r.object_key)).map(r => r.object_key), 'referenced');
      let deleted = 0;
      if (action === 'orphan-cleanup') {
        const due = tracked.filter(r => !referenced.has(r.object_key) && Date.parse(r.quarantine_until) <= Date.now()).map(r => r.object_key);
        if (due.length) { await backend.documents.remove(due); await backend.orphans.mark(due, 'deleted'); deleted = due.length; }
      }
      return finish(json({ ok: true, orphanCount: orphanKeys.length, quarantined: tracked.filter(r => !referenced.has(r.object_key)).length, deleted }), 200);
    }
    if (action === 'export' || action === 'backup') return finish(await exportData(backend, subject, action, url), 200);

    // Generic business command.
    const result = await service.command(subject, role, action, body);
    defer(() => notifyAfterCommand(backend, env, origin, role, action, body, result));
    return finish(json(result), 200);
  } catch (error) {
    const status = error instanceof Fault && Number.isInteger(error.status) ? error.status : 500;
    if (status === 500) console.error(JSON.stringify({ requestId, role, action, error: String(error?.stack || error).slice(0, 500) }));
    return finish(json({ error: status === 500 ? '処理結果を確認できません。最新情報を読み直してから再操作してください。' : error.message, code: error.code || (status === 500 ? 'RESULT_UNKNOWN' : 'APPLICATION_ERROR'), requestId }, status), status);
  }
}

async function limit(backend, ...rules) {
  for (const [key, max] of rules) if (!await backend.rateLimit(key, max)) throw new Fault(429, '試行回数が上限に達しました。15分ほど時間をおいてから再度お試しください。');
}

// Parents get an identity row and household on first sign-in (signup confirmation may
// happen in another browser). Staff identities are only created by setup or invitation.
async function ensureParent(backend, subject, address) {
  let identity = await backend.identities.get(subject);
  if (!identity) identity = await backend.identities.insert({ subject, email: address || '', kind: 'parent' });
  if (identity?.kind === 'parent' && !identity.blocked) await backend.service.openHousehold(subject, address || identity.email || '');
  return identity;
}

async function stateFor(backend, role, subject, address) {
  const current = await backend.service.read(subject, role);
  if (role === 'parent') {
    const archived = await backend.repo.listArchivedBookings({ owner: current.user.householdId });
    const seen = new Set(current.bookings.map(b => b.id));
    const history = archived.filter(r => !seen.has(r.id)).map(r => ({ ...publicBooking(r.data.booking), archived: true, documents: [] }));
    return { ...current, bookings: [...current.bookings, ...history].sort((a, b) => a.date.localeCompare(b.date)), authenticated: true, user: { ...current.user, email: address } };
  }
  const admin = current.permission === 'admin';
  return {
    ...current, authenticated: true, user: { email: address },
    mailConfigured: mailConfigured(),
    ...(admin ? { invitations: (await backend.invites.list()).filter(i => !i.used_at && !i.revoked_at), notifications: await backend.listNotifications() } : {}),
  };
}

const csvCell = value => { let s = value === null || value === undefined ? '' : String(value).replace(/\r?\n/g, ' ').trim(); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replaceAll('"', '""')}"`; };
const jst = iso => iso ? new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '';

async function exportData(backend, subject, action, url) {
  const service = backend.service, s = await service.state(), actor = service.actor(s, subject, 'staff');
  if (action === 'backup') {
    if (actor.permission !== 'admin') throw new Fault(403, '管理権限がありません。');
    const archived = await backend.repo.listArchivedBookings({});
    await service.change(current => { service.actor(current, subject, 'staff'); current.audit.push({ id: crypto.randomUUID(), at: current.clock, recordedAt: new Date().toISOString(), actor: actor.id, event: '全データを書き出し', target: 'backup' }); });
    return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), state: s, archivedBookings: archived }, null, 1), { headers: { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="supportyou-backup-${jstDate(new Date().toISOString())}.json"` } });
  }
  const today = jstDate(new Date().toISOString());
  const from = isCalendarDate(url.searchParams.get('from')) ? url.searchParams.get('from') : addDays(today, -31);
  const to = isCalendarDate(url.searchParams.get('to')) ? url.searchParams.get('to') : today;
  if (from > to || addDays(from, 400) < to) throw new Fault(400, '期間は400日以内で指定してください。');
  const archived = await backend.repo.listArchivedBookings({ from, to });
  const current = s.bookings.filter(b => b.date >= from && b.date <= to);
  const seen = new Set(current.map(b => b.id));
  const rows = [...current, ...archived.filter(r => !seen.has(r.id)).map(r => r.data.booking)].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const children = new Map(s.children.map(c => [c.id, c]));
  const header = ['利用日', '来園予定', 'お迎え予定', '状態', 'お子さま', 'ふりがな', '生年月日', '保護者', '電話', '症状', '服薬', '保育室', '感染区分', '入室', '退室', 'お迎えの方', '利用料金（減免前・円）', '申込み日時'];
  const lines = [header.map(csvCell).join(',')];
  for (const b of rows) {
    const c = children.get(b.childId) || {};
    lines.push([b.date, b.start, b.end, STATUSES[b.status] || b.status, c.name, c.kana, c.birth, c.guardian, c.phone, b.symptom, b.medication ? 'あり' : 'なし', b.room || '', b.group || '', jst(b.checkedInAt), jst(b.completedAt), b.pickup || '', b.fee ?? '', jst(b.createdAt || b.events?.[0]?.at)].map(csvCell).join(','));
  }
  await service.change(currentState => { service.actor(currentState, subject, 'staff'); currentState.audit.push({ id: crypto.randomUUID(), at: currentState.clock, recordedAt: new Date().toISOString(), actor: actor.id, event: `予約一覧CSVを出力（${from}〜${to}）`, target: 'export' }); });
  return new Response('﻿' + lines.join('\r\n'), { headers: { ...baseHeaders, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="supportyou-${from}_${to}.csv"` } });
}

// ---- Notifications (best effort, after the response) ----
async function deliver(backend, env, kind, recipientRole, to, message) {
  if (!to) return;
  const result = await sendMail({ to, ...message }, env);
  await backend.recordNotification({ kind, recipient_role: recipientRole, status: result.status, error: result.error || null }).catch(() => {});
}
async function notifyFacility(backend, env, origin, bookingId, label) {
  const to = env.SUPPORTYOU_FACILITY_EMAIL; if (!to) return;
  const s = await backend.service.state(), b = s.bookings.find(x => x.id === bookingId);
  if (b) await deliver(backend, env, label, 'facility', to, facilityMessage({ date: b.date, label, origin }));
}
async function notifyParent(backend, env, origin, s, b, label) {
  const account = s.accounts.find(a => a.id === b.owner);
  await deliver(backend, env, label, 'parent', account?.email, parentMessage({ date: b.date, label, origin }));
}
async function notifyAfterCommand(backend, env, origin, role, action, body, result) {
  try {
    if (role === 'parent') {
      const labels = { reserve: result.status === 'waitlisted' ? 'キャンセル待ちの申込み' : '新しい申込み', cancel: result.status === 'cancel_requested' ? '当日の取消し申出' : 'キャンセル', message: '保護者からの連絡', 'offer-reply': '繰上げへの返答' };
      if (labels[action] && !result.repeated) await notifyFacility(backend, env, origin, result.id && action === 'reserve' ? result.id : body.id, labels[action]);
      return;
    }
    const s = await backend.service.state();
    if (action === 'close-day') { for (const id of result.changed || []) { const b = s.bookings.find(x => x.id === id); if (b) await notifyParent(backend, env, origin, s, b, `休園のため${STATUSES[b.status]}`); } return; }
    if (action === 'registration' && body.status === 'returned') {
      const c = s.children.find(x => x.id === body.id), account = s.accounts.find(a => a.id === c?.owner);
      await deliver(backend, env, '利用者登録の差戻し', 'parent', account?.email, parentMessage({ label: '利用者登録の修正のお願い', origin }));
      return;
    }
    const labels = { confirm: '予約確定', 'return-documents': '書類の再提出のお願い', reject: '受入不可', 'accept-cancel': 'キャンセル完了', offer: '繰上げのご案内（返答が必要です）', message: '施設からの連絡' };
    if (!labels[action]) return;
    const b = s.bookings.find(x => x.id === body.id);
    if (b) await notifyParent(backend, env, origin, s, b, labels[action]);
  } catch (error) {
    console.error(JSON.stringify({ event: 'notification-failed', action, error: String(error?.message || error).slice(0, 200) }));
  }
}
