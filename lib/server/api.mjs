// Browser-facing API. Framework independent: takes a Request and returns a Response.
// - Sessions live only in HttpOnly __Host- cookies; tokens never reach page scripts.
// - Every POST must come from this origin with the x-supportyou-request header (CSRF).
// - Identity (subject) always comes from the auth provider, never from the request body.
// - Facility-scoped requests carry ?f=<facility id>. Each facility is a separate aggregate
//   with its own house rules, households, staff and documents.
import { Fault, STATUSES, sha, publicBooking, settingsOf } from '../rules.mjs';
import { COMMANDS, DOCUMENT_KINDS } from '../facility-service.mjs';
import { jstDate, isCalendarDate, addDays } from '../calendar.mjs';
import { sniffDocument, inlineTypes, MAX_DOCUMENT_BYTES } from './documents.mjs';
import { sendMail, mailConfigured, parentMessage, facilityMessage, inviteMessage } from './notify.mjs';

export const FACILITY_ID = /^[a-z0-9][a-z0-9-]{1,30}$/;
const GET_ACTIONS = { parent: ['state', 'document', 'facilities'], staff: ['state', 'document', 'export', 'backup'] };
const PUBLIC_ACTIONS = { parent: ['signup', 'login', 'reset-request', 'logout', 'facilities'], staff: ['login', 'setup', 'activate', 'reset-request', 'logout'] };
const SESSION_ACTIONS = {
  parent: ['documents', 'update-password', ...COMMANDS.parent],
  staff: ['update-password', 'join', 'staff-membership', 'staff-invite', 'staff-invite-revoke', 'orphan-scan', 'orphan-cleanup', 'facility-create', 'facility-active', 'owner-invite', 'owner-invite-revoke', ...COMMANDS.staff],
};
// Staff actions that do not target one facility.
const ORG_ACTIONS = new Set(['update-password', 'join', 'facility-create', 'facility-active', 'owner-invite', 'owner-invite-revoke']);
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
const plainName = (value, label) => { const v = String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60); if (!v) throw new Fault(400, `${label}を入力してください。`); return v; };
const randomCode = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
function safeEqual(a, b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }
const clientIp = request => (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
const isOwner = identity => identity?.org_role === 'owner';

export async function handleApi(request, { role, action, backend, env = process.env, defer = fn => { void fn(); } }) {
  const requestId = crypto.randomUUID(), url = new URL(request.url), origin = env.SUPPORTYOU_SITE_URL?.replace(/\/$/, '') || url.origin;
  let subject = null, extraCookies = [];
  const facilityParam = url.searchParams.get('f') || '';
  const finish = (response, status) => {
    for (const c of extraCookies) response.headers.append('Set-Cookie', c);
    defer(() => backend.logEvent({ request_id: requestId, subject, operation: `${role}:${action}${facilityParam ? '@' + facilityParam : ''}`.slice(0, 80), result: status }).catch(() => {}));
    return response;
  };
  // Resolves ?f=. Parents only reach active facilities; staff access is checked per aggregate.
  const facility = async ({ active = false } = {}) => {
    if (!FACILITY_ID.test(facilityParam)) throw new Fault(404, '施設を選択してください。');
    const found = await backend.facilities.get(facilityParam);
    if (!found || (active && !found.active)) throw new Fault(404, 'この施設は現在受付していません。');
    return found;
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
        if (raw.length > 32000) throw new Fault(413, '入力が長すぎます。');
        try { body = JSON.parse(raw || '{}'); } catch { throw new Fault(400, '入力内容を読み取れません。'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Fault(400, '入力内容を読み取れません。');
      }
    }
    const cookies = readCookies(request, role);
    if (cookies.token.length > 8000 || cookies.refreshToken.length > 4000) { extraCookies = clearCookies(role); throw Object.assign(new Fault(401, 'もう一度ログインしてください。'), { code: 'SESSION_INVALID' }); }

    // ---- Actions without a session ----
    if (action === 'facilities') {
      const list = (await backend.facilities.list()).filter(f => f.active).map(({ id, name, municipality }) => ({ id, name, municipality }));
      return finish(json({ facilities: list }), 200);
    }
    if (action === 'state' && !cookies.token && !cookies.refreshToken) {
      if (role === 'staff') return finish(json({ authenticated: false, setupAvailable: !(await backend.config.get()).bootstrap_subject }), 200);
      return finish(json({ authenticated: false, ...(facilityParam ? { facility: publicFacility(await facility({ active: true })) } : {}) }), 200);
    }
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
      await ensureParent(backend, subject, address);
      extraCookies = sessionCookies('parent', signedIn.session);
      return finish(json({ ok: true, state: await parentState(backend, subject, address, facilityParam && await facility({ active: true })) }), 200);
    }
    if (action === 'login') {
      const address = email(body.email);
      if (typeof body.password !== 'string' || body.password.length > 200) throw new Fault(401, 'メールアドレスまたはパスワードが一致しません。');
      await limit(backend, [`login:${await sha(address)}`, 10], [`login-ip:${clientIp(request)}`, 60]);
      const signedIn = await backend.auth.signIn({ email: address, password: body.password });
      subject = signedIn.subject;
      const identity = role === 'parent' ? await ensureParent(backend, subject, address) : await backend.identities.get(subject);
      if (!identity || identity.kind !== role || identity.blocked) {
        await backend.auth.signOut(signedIn.session.accessToken).catch(() => {});
        throw new Fault(403, role === 'staff' ? '職員用アカウントではありません。保護者の方は保護者用ページからログインしてください。' : 'このアカウントは職員用です。職員画面からログインしてください。');
      }
      const state = role === 'parent' ? await parentState(backend, subject, address, facilityParam && await facility({ active: true })) : await staffState(backend, identity, subject, address, facilityParam, env);
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
      // First headquarters owner and first facility. Requires the deploy-time setup code.
      const code = env.SUPPORTYOU_SETUP_CODE || '';
      await limit(backend, [`setup-ip:${clientIp(request)}`, 10]);
      if (code.length < 16 || !safeEqual(String(body.setupCode || ''), code)) throw new Fault(403, '初期設定コードが一致しません。');
      if ((await backend.config.get()).bootstrap_subject) throw new Fault(409, '本部の管理者は登録済みです。ログインしてください。');
      const address = email(body.email), secret = password(body.password), name = plainName(body.name, '氏名');
      const facilityId = String(body.facilityId || '').trim().toLowerCase(), facilityName = plainName(body.facilityName, '最初の施設名');
      if (!FACILITY_ID.test(facilityId)) throw new Fault(400, '施設IDは半角英小文字・数字・ハイフンで2〜31文字にしてください。');
      const created = await backend.auth.createConfirmedUser({ email: address, password: secret });
      subject = created.subject;
      try {
        await backend.identities.insert({ subject, email: address, kind: 'staff', org_role: 'owner', name });
        await backend.config.setBootstrap(subject);
      } catch (error) { await backend.auth.deleteUser(subject).catch(() => {}); throw error; }
      await createFacility(backend, subject, { id: facilityId, name: facilityName, municipality: body.municipality }, { name, email: address });
      const signedIn = await backend.auth.signIn({ email: address, password: secret });
      extraCookies = sessionCookies('staff', signedIn.session);
      return finish(json({ ok: true, state: await staffState(backend, await backend.identities.get(subject), subject, address, facilityId, env) }), 200);
    }
    if (action === 'activate') {
      const address = email(body.email), secret = password(body.password);
      await limit(backend, [`activate:${await sha(address)}`, 10], [`activate-ip:${clientIp(request)}`, 30]);
      const invite = await backend.invites.verify(address, await sha(String(body.code || '').trim()));
      if (!invite) throw new Fault(401, 'メールアドレスまたは招待コードが一致しないか、有効期限が切れています。');
      let created;
      try { created = await backend.auth.createConfirmedUser({ email: address, password: secret }); }
      catch (error) { if (error.status === 409) throw new Fault(409, 'このメールアドレスは登録済みです。ログインしてから「招待コードで施設を追加」を使ってください。'); throw error; }
      subject = created.subject;
      try {
        await backend.identities.insert({ subject, email: address, kind: 'staff', org_role: invite.permission === 'owner' ? 'owner' : null, name: invite.name });
        await applyInvite(backend, subject, address, invite);
      } catch (error) { await backend.auth.deleteUser(subject).catch(() => {}); throw error; }
      await backend.invites.markUsed(invite.invite_id, subject);
      const signedIn = await backend.auth.signIn({ email: address, password: secret });
      extraCookies = sessionCookies('staff', signedIn.session);
      return finish(json({ ok: true, state: await staffState(backend, await backend.identities.get(subject), subject, address, invite.facility_id || '', env) }), 200);
    }

    // ---- Actions with a session ----
    let session;
    try { session = await backend.auth.resolve(cookies); }
    catch (error) { if (error.code === 'SESSION_INVALID') { extraCookies = clearCookies(role); if (action === 'state') return finish(json({ authenticated: false, code: 'SESSION_INVALID' }), 200); } throw error; }
    subject = session.subject;
    if (session.renewed) extraCookies = sessionCookies(role, session.renewed);
    const identity = role === 'parent' ? await ensureParent(backend, subject, session.email) : await backend.identities.get(subject);
    if (!identity || identity.kind !== role || identity.blocked) throw new Fault(403, role === 'staff' ? 'この画面の利用権限がありません。' : 'このアカウントは職員用です。職員画面をご利用ください。');

    if (action === 'update-password') {
      await backend.auth.setPassword(subject, password(body.password));
      return finish(json({ ok: true }), 200);
    }

    if (role === 'parent') {
      if (action === 'state' && !facilityParam) return finish(json(await parentState(backend, subject, session.email, null)), 200);
      const f = await facility({ active: true }), service = backend.service(f.id);
      await service.openHousehold(subject, session.email || identity.email || '');
      if (action === 'state') return finish(json(await parentState(backend, subject, session.email, f)), 200);
      if (action === 'document') return finish(documentResponse(await service.readDocument(subject, 'parent', url.searchParams.get('id') || '')), 200);
      if (action === 'documents') {
        const files = [];
        for (const kind of Object.keys(DOCUMENT_KINDS)) {
          const file = form.get(kind);
          if (!file || typeof file === 'string' || file.size === 0) continue;
          if (file.size > MAX_DOCUMENT_BYTES) throw new Fault(413, `${DOCUMENT_KINDS[kind]}のファイルが大きすぎます（4MBまで）。写真の場合は撮り直してください。`);
          const bytes = new Uint8Array(await file.arrayBuffer()), type = sniffDocument(bytes);
          if (!type) throw new Fault(415, `${DOCUMENT_KINDS[kind]}は写真（JPEG・PNG・HEIC）またはPDFで提出してください。`);
          files.push({ kind, bytes, contentType: type.contentType, ext: type.ext });
        }
        const result = await service.submitDocuments(subject, { id: String(form.get('id') || ''), version: Number(form.get('version')), files });
        defer(() => notifyFacility(backend, env, origin, f, String(form.get('id')), '書類の提出'));
        return finish(json(result), 200);
      }
      const result = await service.command(subject, 'parent', action, body);
      defer(() => notifyAfterCommand(backend, env, origin, f, 'parent', action, body, result));
      return finish(json(result), 200);
    }

    // ---- Staff: organization level ----
    const owner = isOwner(identity);
    if (action === 'state' && !facilityParam) return finish(json(await staffState(backend, identity, subject, session.email, '', env)), 200);
    if (action === 'join') {
      const invite = await backend.invites.verify(identity.email || session.email, await sha(String(body.code || '').trim()));
      if (!invite) throw new Fault(401, '招待コードが一致しないか、有効期限が切れています。招待されたメールアドレスでログインしているか確認してください。');
      await applyInvite(backend, subject, identity.email || session.email, invite);
      await backend.invites.markUsed(invite.invite_id, subject);
      return finish(json({ ok: true, facilityId: invite.facility_id || null }), 200);
    }
    if (ORG_ACTIONS.has(action)) {
      if (!owner) throw new Fault(403, '本部の管理権限がありません。');
      if (action === 'facility-create') {
        const id = String(body.id || '').trim().toLowerCase();
        if (!FACILITY_ID.test(id)) throw new Fault(400, '施設IDは半角英小文字・数字・ハイフンで2〜31文字にしてください。');
        await createFacility(backend, subject, { id, name: plainName(body.name, '施設名'), municipality: body.municipality }, { name: identity.name, email: identity.email });
        return finish(json({ ok: true, id }), 200);
      }
      if (action === 'facility-active') {
        const found = await backend.facilities.get(String(body.id || ''));
        if (!found || typeof body.active !== 'boolean') throw new Fault(404, '施設が見つかりません。');
        await backend.facilities.update(found.id, { active: body.active });
        return finish(json({ ok: true }), 200);
      }
      if (action === 'owner-invite-revoke') {
        if (!await backend.invites.revoke(String(body.id || ''), null)) throw new Fault(409, '招待は使用済み、取消し済み、または見つかりません。');
        return finish(json({ ok: true }), 200);
      }
      return finish(json(await issueInvite(backend, env, origin, subject, body, null, 'owner')), 200);
    }

    // ---- Staff: one facility ----
    const f = await facility(), service = backend.service(f.id);
    if (owner) await service.ensureOwner(subject, { name: identity.name, email: identity.email });
    if (action === 'state') return finish(json(await staffState(backend, identity, subject, session.email, f.id, env)), 200);
    if (action === 'document') return finish(documentResponse(await service.readDocument(subject, 'staff', url.searchParams.get('id') || '')), 200);
    if (action === 'staff-membership') return finish(json(await service.staffMembership(subject, body)), 200);
    if (action === 'staff-invite' || action === 'staff-invite-revoke') {
      const s = await service.state(); service.staffAdmin(s, subject);
      if (action === 'staff-invite-revoke') {
        if (!await backend.invites.revoke(String(body.id || ''), f.id)) throw new Fault(409, '招待は使用済み、取消し済み、または見つかりません。');
        return finish(json({ ok: true }), 200);
      }
      if (!['admin', 'operator'].includes(body.permission)) throw new Fault(400, '権限を選択してください。');
      if (s.memberships.some(m => m.role === 'staff' && m.active && m.email === String(body.email || '').trim().toLowerCase())) throw new Fault(409, 'この職員はこの施設に登録済みです。');
      return finish(json(await issueInvite(backend, env, origin, subject, body, f, body.permission)), 200);
    }
    if (action === 'orphan-scan' || action === 'orphan-cleanup') {
      const s = await service.state(); service.staffAdmin(s, subject);
      const referenced = new Set((s.documentVersions || []).map(d => d.key));
      for (const row of await service.archived({})) for (const d of row.data?.documents || []) referenced.add(d.key);
      const orphanKeys = (await backend.documents.listAll(f.id)).filter(key => key.startsWith(`${f.id}/`) && !referenced.has(key));
      await backend.orphans.record(orphanKeys, subject);
      const tracked = (await backend.orphans.quarantined()).filter(r => r.object_key.startsWith(`${f.id}/`));
      await backend.orphans.mark(tracked.filter(r => referenced.has(r.object_key)).map(r => r.object_key), 'referenced');
      let deleted = 0;
      if (action === 'orphan-cleanup') {
        const due = tracked.filter(r => !referenced.has(r.object_key) && Date.parse(r.quarantine_until) <= Date.now()).map(r => r.object_key);
        if (due.length) { await backend.documents.remove(due); await backend.orphans.mark(due, 'deleted'); deleted = due.length; }
      }
      return finish(json({ ok: true, orphanCount: orphanKeys.length, quarantined: tracked.filter(r => !referenced.has(r.object_key)).length, deleted }), 200);
    }
    if (action === 'export' || action === 'backup') return finish(await exportData(service, f, subject, action, url), 200);

    const result = await service.command(subject, 'staff', action, body);
    if (action === 'update-settings') { const s = settingsOf(await service.state()); await backend.facilities.update(f.id, { name: s.profile.name, municipality: s.profile.municipality }); }
    defer(() => notifyAfterCommand(backend, env, origin, f, 'staff', action, body, result));
    return finish(json(result), 200);
  } catch (error) {
    const status = error instanceof Fault && Number.isInteger(error.status) ? error.status : Number.isInteger(error?.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
    if (status === 500) console.error(JSON.stringify({ requestId, role, action, error: String(error?.stack || error).slice(0, 500) }));
    return finish(json({ error: status === 500 ? '処理結果を確認できません。最新情報を読み直してから再操作してください。' : error.message, code: error.code || (status === 500 ? 'RESULT_UNKNOWN' : 'APPLICATION_ERROR'), requestId }, status), status);
  }
}

async function limit(backend, ...rules) {
  for (const [key, max] of rules) if (!await backend.rateLimit(key, max)) throw new Fault(429, '試行回数が上限に達しました。15分ほど時間をおいてから再度お試しください。');
}

// Parents get an identity row on first sign-in (signup confirmation may happen in another
// browser); a household is opened per facility on first use. Staff identities are only
// created by setup or invitation.
export async function ensureParent(backend, subject, address) {
  let identity = await backend.identities.get(subject);
  if (!identity) identity = await backend.identities.insert({ subject, email: address || '', kind: 'parent' });
  return identity;
}

async function createFacility(backend, subject, { id, name, municipality }, ownerProfile) {
  await backend.facilities.create({ id, name, municipality: String(municipality || '').trim().slice(0, 40) });
  const service = backend.service(id);
  await service.initialize({ name, municipality: String(municipality || '').trim().slice(0, 40) });
  await service.ensureOwner(subject, ownerProfile);
}

async function applyInvite(backend, subject, address, invite) {
  if (invite.permission === 'owner') { await backend.identities.setOrgRole(subject, 'owner'); return; }
  const found = await backend.facilities.get(invite.facility_id);
  if (!found) throw new Fault(404, '招待先の施設が見つかりません。');
  await backend.service(found.id).acceptStaffInvitation(subject, { permission: invite.permission, name: invite.name, email: address, invitationId: invite.invite_id });
}

async function issueInvite(backend, env, origin, subject, body, f, permission) {
  const address = email(body.email), name = plainName(body.name, '氏名');
  const code = randomCode();
  const row = await backend.invites.create({ email: address, name, permission, facility_id: f?.id || null, code_hash: await sha(code), expires_at: new Date(Date.now() + 72 * 3600_000).toISOString(), created_by: subject });
  const where = f ? f.name : '本部';
  const mailed = body.sendEmail === true && mailConfigured(env) ? await sendMail({ to: address, ...inviteMessage({ name, code, origin, expiresAt: row.expires_at, where }) }, env) : { status: 'skipped' };
  await backend.recordNotification({ kind: `職員招待（${where}）`, recipient_role: 'staff', status: mailed.status, error: mailed.error || null, facility_id: f?.id || null }).catch(() => {});
  return { ok: true, code, expiresAt: row.expires_at, mailed: mailed.status === 'sent' };
}

function publicFacility(f) { return { id: f.id, name: f.name, municipality: f.municipality || '' }; }

async function parentState(backend, subject, address, f) {
  const facilities = (await backend.facilities.list()).filter(x => x.active).map(publicFacility);
  if (!f) return { authenticated: true, user: { email: address }, facilities };
  const service = backend.service(f.id);
  await service.openHousehold(subject, address || '');
  const current = await service.read(subject, 'parent');
  const archived = await service.archived({ owner: current.user.householdId });
  const seen = new Set(current.bookings.map(b => b.id));
  const history = archived.filter(r => !seen.has(r.id)).map(r => ({ ...publicBooking(r.data.booking), archived: true, documents: [] }));
  return { ...current, facility: publicFacility(f), facilities, bookings: [...current.bookings, ...history].sort((a, b) => a.date.localeCompare(b.date)), authenticated: true, user: { ...current.user, email: address } };
}

// Facilities this staff member can open: every facility for owners, otherwise the ones
// with an active membership.
async function accessibleFacilities(backend, identity, subject) {
  const all = await backend.facilities.list();
  if (isOwner(identity)) return all;
  const out = [];
  for (const f of all) {
    const s = await backend.service(f.id).state();
    if ((s.memberships || []).some(m => m.subject === subject && m.role === 'staff' && m.active)) out.push(f);
  }
  return out;
}

async function staffState(backend, identity, subject, address, facilityId, env) {
  const owner = isOwner(identity);
  const facilities = (await accessibleFacilities(backend, identity, subject)).map(f => ({ ...publicFacility(f), active: f.active !== false }));
  const base = { authenticated: true, user: { email: address }, owner, facilities, mailConfigured: mailConfigured(env),
    ...(owner ? { ownerInvites: await backend.invites.list(null), owners: (await backend.identities.owners()).map(o => ({ email: o.email })) } : {}) };
  if (!facilityId || !facilities.some(f => f.id === facilityId)) return base;
  const service = backend.service(facilityId);
  if (owner) await service.ensureOwner(subject, { name: identity.name, email: identity.email });
  const current = await service.read(subject, 'staff');
  const admin = current.permission === 'admin';
  return { ...base, ...current, facility: facilities.find(f => f.id === facilityId),
    ...(admin ? { invitations: await backend.invites.list(facilityId), notifications: await backend.listNotifications(facilityId) } : {}) };
}

function documentResponse(doc) {
  const headers = { ...baseHeaders, 'Content-Type': doc.contentType, 'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox", 'Content-Disposition': `${inlineTypes.has(doc.contentType) ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(doc.name)}` };
  return new Response(doc.bytes, { status: 200, headers });
}

const csvCell = value => { let s = value === null || value === undefined ? '' : String(value).replace(/\r?\n/g, ' ').trim(); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replaceAll('"', '""')}"`; };
const jst = iso => iso ? new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '';
const auditExport = (service, subject, actor, event) => service.change(current => { service.actor(current, subject, 'staff'); current.audit.push({ id: crypto.randomUUID(), at: current.clock, recordedAt: new Date().toISOString(), actor: actor.id, event, target: 'export' }); });

async function exportData(service, f, subject, action, url) {
  const s = await service.state(), actor = service.actor(s, subject, 'staff');
  if (action === 'backup') {
    if (actor.permission !== 'admin') throw new Fault(403, '管理権限がありません。');
    const archived = await service.archived({});
    await auditExport(service, subject, actor, '全データを書き出し');
    return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), facility: f, state: s, archivedBookings: archived }, null, 1), { headers: { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="supportyou-${f.id}-backup-${jstDate(new Date().toISOString())}.json"` } });
  }
  const today = jstDate(new Date().toISOString());
  const from = isCalendarDate(url.searchParams.get('from')) ? url.searchParams.get('from') : addDays(today, -31);
  const to = isCalendarDate(url.searchParams.get('to')) ? url.searchParams.get('to') : today;
  if (from > to || addDays(from, 400) < to) throw new Fault(400, '期間は400日以内で指定してください。');
  const archived = await service.archived({ from, to });
  const current = s.bookings.filter(b => b.date >= from && b.date <= to);
  const seen = new Set(current.map(b => b.id));
  const rows = [...current, ...archived.filter(r => !seen.has(r.id)).map(r => r.data.booking)].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const children = new Map(s.children.map(c => [c.id, c]));
  const header = ['施設', '利用日', '来園予定', 'お迎え予定', '状態', 'お子さま', 'ふりがな', '生年月日', '保護者', '電話', '症状', '服薬', '保育室', '感染区分', '入室', '退室', 'お迎えの方', '利用料金（減免前・円）', '申込み日時', '適用ルール版'];
  const lines = [header.map(csvCell).join(',')];
  for (const b of rows) {
    const c = children.get(b.childId) || {};
    lines.push([f.name, b.date, b.start, b.end, STATUSES[b.status] || b.status, c.name, c.kana, c.birth, c.guardian, c.phone, b.symptom, b.medication ? 'あり' : 'なし', b.room || '', b.group || '', jst(b.checkedInAt), jst(b.completedAt), b.pickup || '', b.fee ?? '', jst(b.createdAt || b.events?.[0]?.at), b.rulesVersion ?? ''].map(csvCell).join(','));
  }
  await auditExport(service, subject, actor, `予約一覧CSVを出力（${from}〜${to}）`);
  return new Response('﻿' + lines.join('\r\n'), { headers: { ...baseHeaders, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="supportyou-${f.id}-${from}_${to}.csv"` } });
}

// ---- Notifications (best effort, after the response) ----
async function deliver(backend, env, f, kind, recipientRole, to, message) {
  if (!to) return;
  const result = await sendMail({ to, ...message }, env);
  await backend.recordNotification({ kind, recipient_role: recipientRole, status: result.status, error: result.error || null, facility_id: f.id }).catch(() => {});
}
async function notifyFacility(backend, env, origin, f, bookingId, label) {
  const s = await backend.service(f.id).state(), to = settingsOf(s).profile.email || env.SUPPORTYOU_FACILITY_EMAIL;
  const b = s.bookings.find(x => x.id === bookingId);
  if (b && to) await deliver(backend, env, f, label, 'facility', to, facilityMessage({ date: b.date, label, origin, facility: settingsOf(s).profile, facilityId: f.id }));
}
async function notifyParent(backend, env, origin, f, s, owner, date, label) {
  const account = s.accounts.find(a => a.id === owner);
  await deliver(backend, env, f, label, 'parent', account?.email, parentMessage({ date, label, origin, facility: settingsOf(s).profile, facilityId: f.id }));
}
async function notifyAfterCommand(backend, env, origin, f, role, action, body, result) {
  try {
    if (role === 'parent') {
      const labels = { reserve: result.status === 'waitlisted' ? 'キャンセル待ちの申込み' : '新しい申込み', cancel: result.status === 'cancel_requested' ? '当日の取消し申出' : 'キャンセル', message: '保護者からの連絡', 'offer-reply': '繰上げへの返答' };
      if (labels[action] && !result.repeated) await notifyFacility(backend, env, origin, f, action === 'reserve' ? result.id : body.id, labels[action]);
      return;
    }
    const s = await backend.service(f.id).state();
    if (action === 'close-day') { for (const id of result.changed || []) { const b = s.bookings.find(x => x.id === id); if (b) await notifyParent(backend, env, origin, f, s, b.owner, b.date, `休園のため${STATUSES[b.status]}`); } return; }
    if (action === 'registration' && body.status === 'returned') {
      const c = s.children.find(x => x.id === body.id);
      if (c) await notifyParent(backend, env, origin, f, s, c.owner, null, '利用者登録の修正のお願い');
      return;
    }
    const labels = { confirm: '予約確定', 'return-documents': '書類の再提出のお願い', reject: '受入不可', 'accept-cancel': 'キャンセル完了', offer: '繰上げのご案内（返答が必要です）', message: '施設からの連絡' };
    if (!labels[action]) return;
    const b = s.bookings.find(x => x.id === body.id);
    if (b) await notifyParent(backend, env, origin, f, s, b.owner, b.date, labels[action]);
  } catch (error) {
    console.error(JSON.stringify({ event: 'notification-failed', action, error: String(error?.message || error).slice(0, 200) }));
  }
}
