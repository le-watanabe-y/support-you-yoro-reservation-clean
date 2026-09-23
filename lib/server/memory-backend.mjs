// In-process backend for automated tests and local UI checks (npm run dev:mock).
// Never used in production: lib/server/backend.mjs refuses it when NODE_ENV=production.
import { Fault } from '../rules.mjs';
import { FacilityService } from '../facility-service.mjs';
import { MemoryRepository, MemoryDocuments } from '../memory-repository.mjs';

const token = () => crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');

export function createMemoryBackend({ now } = {}) {
  const repo = new MemoryRepository(), documents = new MemoryDocuments();
  const services = new Map();
  const service = facilityId => { if (!services.has(facilityId)) services.set(facilityId, new FacilityService(repo, { facilityId, documentStore: documents, ...(now ? { now } : {}) })); return services.get(facilityId); };
  const users = new Map(), sessions = new Map(), refreshes = new Map(), links = [];
  const rows = { facilities: [], identities: new Map(), invites: [], orphans: new Map(), events: [], notifications: [], rate: new Map() };
  let bootstrap = null;
  const issue = subject => {
    const access = token(), refresh = token();
    sessions.set(access, { subject, expires: Date.now() + 3600_000 }); refreshes.set(refresh, subject);
    return { accessToken: access, refreshToken: refresh, expiresIn: 3600 };
  };
  const bySubject = subject => [...users.values()].find(u => u.subject === subject);
  const auth = {
    async signUp({ email, password }) {
      if (password.length < 8) throw new Fault(400, 'パスワードが簡単すぎます。別のパスワードにしてください。');
      if (users.has(email)) return { session: null };
      users.set(email, { subject: crypto.randomUUID(), email, password, confirmed: true });
      return { session: issue(users.get(email).subject) };
    },
    async signIn({ email, password }) {
      const user = users.get(email);
      if (!user || user.password !== password || user.banned) { const e = new Fault(401, 'メールアドレスまたはパスワードが一致しません。'); e.code = 'INVALID_CREDENTIALS'; throw e; }
      return { subject: user.subject, email, session: issue(user.subject) };
    },
    async resolve({ token: access, refreshToken }) {
      const live = sessions.get(access);
      if (live && live.expires > Date.now() && !bySubject(live.subject)?.banned) return { subject: live.subject, email: bySubject(live.subject)?.email, token: access, renewed: null };
      const subject = refreshes.get(refreshToken);
      if (subject && !bySubject(subject)?.banned) { refreshes.delete(refreshToken); const renewed = issue(subject); return { subject, email: bySubject(subject)?.email, token: renewed.accessToken, renewed }; }
      const e = new Fault(401, 'もう一度ログインしてください。'); e.code = 'SESSION_INVALID'; throw e;
    },
    async signOut(access) { const live = sessions.get(access); sessions.delete(access); if (live) for (const [k, v] of refreshes) if (v === live.subject) refreshes.delete(k); },
    async requestPasswordReset(email) { if (users.has(email)) links.push({ email, type: 'recovery', tokenHash: token() }); },
    async verifyOtp({ tokenHash, type }) {
      const link = links.find(l => l.tokenHash === tokenHash && l.type === type && !l.used);
      if (!link) { const e = new Fault(400, 'リンクの有効期限が切れているか、既に使用されています。'); e.code = 'LINK_INVALID'; throw e; }
      link.used = true; const user = users.get(link.email);
      return { subject: user.subject, email: user.email, session: issue(user.subject) };
    },
    async setPassword(subject, password) { bySubject(subject).password = password; },
    async createConfirmedUser({ email, password }) {
      if (users.has(email)) throw new Fault(409, 'このメールアドレスは登録済みか、パスワードが条件を満たしていません。');
      const subject = crypto.randomUUID(); users.set(email, { subject, email, password, confirmed: true }); return { subject };
    },
    async deleteUser(subject) { for (const [email, u] of users) if (u.subject === subject) users.delete(email); },
    async banUser(subject, banned) { const u = bySubject(subject); if (u) u.banned = banned; },
  };
  const identities = {
    async get(subject) { return rows.identities.get(subject) || null; },
    async insert(row) { if (!rows.identities.has(row.subject)) rows.identities.set(row.subject, { blocked: false, ...row }); return rows.identities.get(row.subject); },
    async setBlocked(subject, blocked) { const r = rows.identities.get(subject); if (r) r.blocked = blocked; },
    async setOrgRole(subject, role) { const r = rows.identities.get(subject); if (r && r.kind === 'staff') r.org_role = role; },
    async owners() { return [...rows.identities.values()].filter(r => r.org_role === 'owner' && !r.blocked); },
  };
  const facilities = {
    async list() { return rows.facilities.map(f => ({ ...f })); },
    async get(id) { const f = rows.facilities.find(x => x.id === id); return f ? { ...f } : null; },
    async create(row) { if (rows.facilities.some(x => x.id === row.id)) throw new Fault(409, 'この施設IDは使用済みです。'); rows.facilities.push({ active: true, municipality: '', created_at: new Date().toISOString(), ...row }); },
    async update(id, row) { const f = rows.facilities.find(x => x.id === id); if (f) Object.assign(f, row); },
  };
  const invites = {
    async create(row) {
      for (const i of rows.invites) if (i.email === row.email && (i.facility_id || null) === (row.facility_id || null) && !i.used_at && !i.revoked_at) i.revoked_at = new Date().toISOString();
      const created = { id: crypto.randomUUID(), attempts: 0, created_at: new Date().toISOString(), used_at: null, revoked_at: null, ...row };
      rows.invites.push(created); return created;
    },
    async list(facilityId) { return rows.invites.filter(i => (i.facility_id || null) === (facilityId || null) && !i.used_at && !i.revoked_at).reverse(); },
    async revoke(id, facilityId) { const i = rows.invites.find(x => x.id === id && (x.facility_id || null) === (facilityId || null) && !x.used_at && !x.revoked_at); if (!i) return false; i.revoked_at = new Date().toISOString(); return true; },
    async verify(email, codeHash) {
      const live = rows.invites.filter(x => x.email === email && !x.used_at && !x.revoked_at && Date.parse(x.expires_at) > Date.now() && x.attempts < 5);
      const i = live.find(x => x.code_hash === codeHash);
      if (!i) { for (const x of live) x.attempts++; return null; }
      return { invite_id: i.id, permission: i.permission, name: i.name, facility_id: i.facility_id || null };
    },
    async markUsed(id, subject) { const i = rows.invites.find(x => x.id === id); if (i && !i.used_at) { i.used_at = new Date().toISOString(); i.activated_subject = subject; } },
  };
  const config = {
    async get() { return { bootstrap_subject: bootstrap }; },
    async setBootstrap(subject) { if (bootstrap) throw new Fault(409, '初期管理者は登録済みです。'); bootstrap = subject; },
  };
  const orphans = {
    async record(keys) { for (const k of keys) if (!rows.orphans.has(k)) rows.orphans.set(k, { object_key: k, quarantine_until: new Date(Date.now() + 86400000).toISOString(), status: 'quarantined' }); },
    async quarantined() { return [...rows.orphans.values()].filter(r => r.status === 'quarantined'); },
    async mark(keys, status) { for (const k of keys) { const r = rows.orphans.get(k); if (r) r.status = status; } },
  };
  return {
    kind: 'memory', service, facilities, repo, documents, auth, identities, invites, config, orphans, links, rows, users,
    async rateLimit(key, max) { const r = rows.rate.get(key) || { hits: 0, until: Date.now() + 900000 }; if (r.until < Date.now()) { r.hits = 0; r.until = Date.now() + 900000; } r.hits++; rows.rate.set(key, r); return r.hits <= max; },
    async logEvent(row) { rows.events.push(row); },
    async recordNotification(row) { rows.notifications.push({ id: rows.notifications.length + 1, created_at: new Date().toISOString(), ...row }); },
    async listNotifications(facilityId) { return rows.notifications.filter(n => n.facility_id === facilityId).slice(-30).reverse(); },
  };
}
