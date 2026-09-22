// Supabase implementation of the backend contract used by lib/server/api.mjs.
// Uses the service-role key on the server only. Browser roles have no table access
// (see supabase/migrations): every read and write goes through the authorized API.
import { createClient } from '@supabase/supabase-js';
import { Fault, newState } from '../rules.mjs';
import { compact } from '../compaction.mjs';
import { FacilityService } from '../facility-service.mjs';

const BUCKET = 'supportyou-documents';
const STATE_LIMIT = 4_000_000;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const fail = (message, status = 503) => { throw new Fault(status, message); };
const check = ({ data, error }, message = '保存先の処理を確認できません。時間をおいて再度お試しください。') => { if (error) fail(message); return data; };

function sessionError(message, code, status = 401) { const e = new Fault(status, message); e.code = code; return e; }
// Temporary provider failures must not look like an invalid session (which clears cookies).
function authProviderError(error, message, code) {
  if (!Number.isInteger(error?.status) || error.status < 400 || error.status >= 500 || error.status === 408 || error.status === 429)
    return sessionError('認証サービスとの通信を確認できません。時間をおいて再度お試しください。', 'AUTH_TEMPORARY_UNAVAILABLE', 503);
  return sessionError(message, code);
}
const sessionOf = data => ({ accessToken: data.session.access_token, refreshToken: data.session.refresh_token, expiresIn: data.session.expires_in });

export class SupabaseRepository {
  constructor(db) { this.db = db; }
  async read(key) {
    const data = check(await this.db.from('supportyou_state').select('revision,data').eq('id', key).maybeSingle(), '保存先を読み込めません。時間をおいて再度確認してください。');
    return data ? { revision: data.revision, state: data.data } : { revision: -1, state: newState() };
  }
  async change(key, operation) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const { revision, state } = await this.read(key);
      const result = await operation(state);
      const archive = compact(state);
      if (archive.bookings.length) check(await this.db.from('supportyou_booking_archive').upsert(archive.bookings.map(r => ({ ...r, facility_key: key })), { onConflict: 'id' }));
      if (archive.audit.length) check(await this.db.from('supportyou_audit_archive').upsert(archive.audit.map(r => ({ ...r, facility_key: key })), { onConflict: 'id', ignoreDuplicates: true }));
      if (new TextEncoder().encode(JSON.stringify(state)).length >= STATE_LIMIT) fail('保存容量の上限です。管理者へ連絡してください。', 409);
      const saved = check(await this.db.rpc('supportyou_cas', { p_id: key, p_revision: revision, p_data: state }), '保存結果を確認できません。最新情報を読み直してから再操作してください。');
      if (saved === true) return result;
    }
    fail('同時に変更されました。入力を保持したまま最新情報を確認してください。', 409);
  }
  async listArchivedBookings({ owner, from, to } = {}) {
    let query = this.db.from('supportyou_booking_archive').select('id,owner,date,status,data').order('date', { ascending: false }).limit(2000);
    if (owner) query = query.eq('owner', owner);
    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);
    return check(await query);
  }
}

export class SupabaseDocuments {
  constructor(db) { this.db = db; this.bucket = db.storage.from(BUCKET); }
  async put(key, bytes, contentType) {
    const { error } = await this.bucket.upload(key, bytes, { contentType, upsert: false });
    if (error) fail('書類を保存できません。提出は完了していません。');
  }
  async get(key) { const { data, error } = await this.bucket.download(key); if (error) fail('書類を読み込めません。'); return new Uint8Array(await data.arrayBuffer()); }
  async remove(keys) { const { error } = await this.bucket.remove(keys); if (error) fail('未参照の書類を削除できません。'); }
  async listAll(prefix = '', depth = 0) {
    if (depth > 5) fail('書類の保存階層を確認できません。');
    const keys = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await this.bucket.list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error) fail('書類の保存状態を確認できません。');
      for (const item of data || []) { const key = prefix ? `${prefix}/${item.name}` : item.name; if (item.id) keys.push(key); else keys.push(...await this.listAll(key, depth + 1)); }
      if ((data || []).length < 1000) break;
    }
    return keys;
  }
  async quarantine(keys, subject) {
    const { error } = await this.db.from('supportyou_orphan_documents').upsert(keys.map(object_key => ({ object_key, detected_by: subject, status: 'quarantined' })), { onConflict: 'object_key', ignoreDuplicates: true });
    if (error) fail('未参照書類の隔離記録を保存できません。');
  }
}

export function createSupabaseBackend(env = process.env) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  const anon = env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !secret || !anon) fail('保存先の接続設定（SUPABASE_URL・SUPABASE_SERVICE_ROLE_KEY・SUPABASE_ANON_KEY）が必要です。');
  const db = createClient(url, secret, clientOptions);
  const authClient = () => createClient(url, anon, clientOptions);
  const repo = new SupabaseRepository(db), documents = new SupabaseDocuments(db);
  const service = new FacilityService(repo, { facilityId: env.SUPPORTYOU_FACILITY_ID || 'support-you', documentStore: documents });

  const auth = {
    async signUp({ email, password, redirectTo }) {
      const { data, error } = await authClient().auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
      if (error) {
        if (error.status === 422 || error.status === 400) throw new Fault(400, error.code === 'weak_password' ? 'パスワードが簡単すぎます。別のパスワードにしてください。' : '登録できませんでした。メールアドレスとパスワードを確認してください。');
        throw authProviderError(error, '登録できませんでした。', 'SIGNUP_FAILED');
      }
      return { session: data.session ? sessionOf(data) : null };
    },
    async signIn({ email, password }) {
      const { data, error } = await authClient().auth.signInWithPassword({ email, password });
      if (error) {
        if (error.code === 'email_not_confirmed') throw sessionError('メールアドレスの確認が完了していません。届いた確認メールのリンクを開いてください。', 'EMAIL_NOT_CONFIRMED', 403);
        throw authProviderError(error, 'メールアドレスまたはパスワードが一致しません。', 'INVALID_CREDENTIALS');
      }
      return { subject: data.user.id, email: data.user.email, session: sessionOf(data) };
    },
    async resolve({ token, refreshToken }) {
      let user = null, renewed = null;
      if (token) {
        const result = await authClient().auth.getUser(token);
        if (result.error) { const e = authProviderError(result.error, 'ログインの有効期限が切れました。もう一度ログインしてください。', 'SESSION_INVALID'); if (e.status !== 401 || !refreshToken) throw e; }
        else user = result.data?.user;
      }
      if (!user && refreshToken) {
        const result = await authClient().auth.refreshSession({ refresh_token: refreshToken });
        if (result.error) throw authProviderError(result.error, 'ログインの有効期限が切れました。もう一度ログインしてください。', 'SESSION_INVALID');
        if (!result.data?.session || !result.data?.user) throw sessionError('もう一度ログインしてください。', 'SESSION_INVALID');
        user = result.data.user; renewed = sessionOf(result.data); token = renewed.accessToken;
      }
      if (!user) throw sessionError('もう一度ログインしてください。', 'SESSION_INVALID');
      return { subject: user.id, email: user.email, token, renewed };
    },
    async signOut(token) { const { error } = await db.auth.admin.signOut(token, 'local'); if (error && error.status !== 401 && error.status !== 404) fail('ログアウトを確認できません。再度お試しください。'); },
    async requestPasswordReset(email, redirectTo) { const { error } = await authClient().auth.resetPasswordForEmail(email, { redirectTo }); if (error && (error.status >= 500 || error.status === 429)) fail('送信できませんでした。時間をおいて再度お試しください。'); },
    async verifyOtp({ tokenHash, type }) {
      const { data, error } = await authClient().auth.verifyOtp({ token_hash: tokenHash, type });
      if (error || !data.session) throw sessionError('リンクの有効期限が切れているか、既に使用されています。もう一度お手続きください。', 'LINK_INVALID', 400);
      return { subject: data.user.id, email: data.user.email, session: sessionOf(data) };
    },
    async setPassword(subject, password) {
      const { error } = await db.auth.admin.updateUserById(subject, { password });
      if (error) throw new Fault(error.status === 422 ? 400 : 503, error.status === 422 ? 'このパスワードは使用できません。別のパスワードにしてください。' : 'パスワードを変更できません。時間をおいて再度お試しください。');
    },
    async createConfirmedUser({ email, password }) {
      const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw new Fault(error.status === 422 ? 409 : 503, error.status === 422 ? 'このメールアドレスは登録済みか、パスワードが条件を満たしていません。' : 'アカウントを作成できません。時間をおいて再度お試しください。');
      return { subject: data.user.id };
    },
    async deleteUser(subject) { await db.auth.admin.deleteUser(subject); },
    async banUser(subject, banned) { await db.auth.admin.updateUserById(subject, { ban_duration: banned ? '876000h' : 'none' }); },
  };

  const identities = {
    async get(subject) { return check(await db.from('supportyou_identities').select('subject,email,kind,blocked').eq('subject', subject).maybeSingle()); },
    async insert(row) {
      const { error } = await db.from('supportyou_identities').insert(row);
      if (error && error.code !== '23505') fail('利用者情報を保存できません。');
      return this.get(row.subject);
    },
    async setBlocked(subject, blocked) { check(await db.from('supportyou_identities').update({ blocked }).eq('subject', subject)); },
  };

  const invites = {
    async create(row) {
      check(await db.from('supportyou_staff_invites').update({ revoked_at: new Date().toISOString() }).eq('email', row.email).is('used_at', null).is('revoked_at', null));
      return check(await db.from('supportyou_staff_invites').insert(row).select('id,email,name,permission,expires_at').single());
    },
    async list() { return check(await db.from('supportyou_staff_invites').select('id,email,name,permission,expires_at,created_at,used_at,revoked_at').order('created_at', { ascending: false }).limit(30)); },
    async revoke(id) { return check(await db.from('supportyou_staff_invites').update({ revoked_at: new Date().toISOString() }).eq('id', id).is('used_at', null).is('revoked_at', null).select('id')).length === 1; },
    async verify(email, codeHash) { return (check(await db.rpc('supportyou_verify_staff_invite', { p_email: email, p_hash: codeHash })) || [])[0] || null; },
    async markUsed(id, subject) { check(await db.from('supportyou_staff_invites').update({ used_at: new Date().toISOString(), activated_subject: subject }).eq('id', id).is('used_at', null)); },
  };

  const config = {
    async get() { return check(await db.from('supportyou_config').select('bootstrap_subject').eq('id', true).maybeSingle()) || { bootstrap_subject: null }; },
    async setBootstrap(subject) {
      const { error } = await db.from('supportyou_config').insert({ id: true, bootstrap_subject: subject });
      if (error) fail('初期管理者は登録済みです。', 409);
    },
  };

  const orphans = {
    async record(keys, subject) { if (keys.length) check(await db.from('supportyou_orphan_documents').upsert(keys.map(object_key => ({ object_key, detected_by: subject, status: 'quarantined' })), { onConflict: 'object_key', ignoreDuplicates: true })); },
    async quarantined() { return check(await db.from('supportyou_orphan_documents').select('object_key,quarantine_until').eq('status', 'quarantined')); },
    async mark(keys, status) { if (keys.length) check(await db.from('supportyou_orphan_documents').update({ status, resolved_at: new Date().toISOString() }).in('object_key', keys)); },
  };

  return {
    kind: 'supabase', service, repo, documents, auth, identities, invites, config, orphans,
    async rateLimit(key, max) { return check(await db.rpc('supportyou_rate_limit', { p_key: key, p_max: max })) === true; },
    async logEvent(row) { await db.from('supportyou_security_events').insert(row); },
    async recordNotification(row) { await db.from('supportyou_notifications').insert(row); },
    async listNotifications() { return check(await db.from('supportyou_notifications').select('id,kind,recipient_role,status,error,created_at').order('created_at', { ascending: false }).limit(30)); },
  };
}
