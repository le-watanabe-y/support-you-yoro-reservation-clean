// Keeps the facility aggregate small. Finished bookings and old audit entries move to
// append-only archive tables. Archive writes are idempotent upserts made BEFORE the
// compare-and-swap, so a lost or retried commit never loses a record (at worst a row
// exists in both places, and readers de-duplicate by id).
import { TERMINAL } from './rules.mjs';
import { addDays, jstDate } from './calendar.mjs';

export const ARCHIVE_AFTER_DAYS = 45;
export const AUDIT_KEEP = 1000;
export const RECEIPT_KEEP_DAYS = 3;

export function compact(state) {
  if (!Array.isArray(state.bookings)) return { bookings: [], audit: [] };
  const cutoff = addDays(jstDate(state.clock), -ARCHIVE_AFTER_DAYS);
  const old = state.bookings.filter(b => TERMINAL.includes(b.status) && b.date < cutoff);
  const oldIds = new Set(old.map(b => b.id));
  const bookings = old.map(b => ({
    id: b.id, owner: b.owner, date: b.date, status: b.status,
    data: { booking: b, documents: (state.documentVersions || []).filter(d => d.bookingId === b.id) },
  }));
  if (old.length) {
    state.bookings = state.bookings.filter(b => !oldIds.has(b.id));
    state.documentVersions = (state.documentVersions || []).filter(d => !oldIds.has(d.bookingId));
    state.incidents = (state.incidents || []).filter(i => !(i.resolved && oldIds.has(i.bookingId)));
  }
  const overflow = state.audit.length > AUDIT_KEEP ? state.audit.slice(0, state.audit.length - AUDIT_KEEP) : [];
  if (overflow.length) state.audit = state.audit.slice(-AUDIT_KEEP);
  const receiptCutoff = Date.parse(state.clock) - RECEIPT_KEEP_DAYS * 86400000;
  state.receipts = (state.receipts || []).filter(r => !r.at || Date.parse(r.at) >= receiptCutoff);
  return { bookings, audit: overflow.map(a => ({ id: a.id, at: a.recordedAt || a.at, data: a })) };
}
