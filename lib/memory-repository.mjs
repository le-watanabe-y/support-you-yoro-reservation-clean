// In-process repository with the same compare-and-swap contract as the Supabase one.
// Used by the automated tests and the local mock backend (never in production).
import { newState, Fault } from './rules.mjs';
import { compact } from './compaction.mjs';

export class MemoryRepository {
  constructor() { this.rows = new Map(); this.archivedBookings = new Map(); this.archivedAudit = new Map(); this.beforeCommit = null; }
  async read(key) {
    const row = this.rows.get(key);
    return row ? { revision: row.revision, state: JSON.parse(row.data) } : { revision: -1, state: newState() };
  }
  async change(key, operation) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const { revision, state } = await this.read(key);
      const result = await operation(state);
      const archive = compact(state);
      for (const row of archive.bookings) this.archivedBookings.set(row.id, structuredClone({ ...row, facility_key: key }));
      for (const row of archive.audit) this.archivedAudit.set(row.id, structuredClone(row));
      // Test hook: simulate a concurrent writer or a lost response around the commit.
      if (this.beforeCommit) await this.beforeCommit({ key, revision, attempt });
      const current = this.rows.get(key);
      if ((current ? current.revision : -1) !== revision) continue;
      this.rows.set(key, { revision: revision + 1, data: JSON.stringify(state) });
      return result;
    }
    throw new Fault(409, '同時に変更されました。入力を保持したまま最新情報を確認してください。');
  }
  async listArchivedBookings({ key, owner, from, to } = {}) {
    return [...this.archivedBookings.values()].filter(r => r.facility_key === key && (!owner || r.owner === owner) && (!from || r.date >= from) && (!to || r.date <= to)).map(r => structuredClone(r));
  }
}

export class MemoryDocuments {
  constructor() { this.objects = new Map(); this.quarantined = new Set(); this.failNext = 0; }
  async put(key, bytes, contentType) {
    if (this.failNext > 0) { this.failNext--; throw new Fault(503, '書類を保存できません。提出は完了していません。'); }
    this.objects.set(key, { bytes: new Uint8Array(bytes), contentType });
  }
  async get(key) { return this.objects.get(key)?.bytes || null; }
  async remove(keys) { for (const key of keys) this.objects.delete(key); }
  async listAll(prefix = '') { return [...this.objects.keys()].filter(key => key.startsWith(prefix)); }
  async quarantine(keys) { for (const key of keys) this.quarantined.add(key); }
}
