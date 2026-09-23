// Facility application core. Server only.
// subject is the verified Supabase Auth user id supplied by the server auth adapter.
// Never populate it from request JSON, email, role claims or unchecked JWT decoding.
import { executeBusiness, publicBooking, publicChild, availabilityList, closureOf, capacityOf, settingsOf, audit, event, need, Fault, text, STATUSES, TERMINAL, HOLD } from './rules.mjs';
import { DEFAULT_SETTINGS, validateSettings } from './settings.mjs';
import { at, jstDate, addDays, isCalendarDate } from './calendar.mjs';

export { Fault as WorkflowError };
const uuid = () => crypto.randomUUID();
const finished = b => TERMINAL.includes(b.status);
const held = b => HOLD.includes(b.status);
const revise = (record, version) => need(Number.isInteger(version) && record.version === version, '最新の内容を確認してください。', 409);
const snapshot = value => structuredClone(value);
const labels = { 'close-day': '休園を設定', 'reopen-day': '休園設定を解除', capacity: '受入上限を変更', assign: '担当者と期限を設定', offer: '繰上げ意思を確認', 'offer-reply': '繰上げに返答', 'expire-offer': '繰上げ返答期限を確認', 'resolve-incident': '休園中の個別対応を完了' };
export const DOCUMENT_KINDS = { physician: '医師連絡票', medicine: '与薬依頼書' };

// Operations a parent or staff member can send through the generic command endpoint.
export const COMMANDS = {
  parent: ['register-child', 'edit-child', 'reserve', 'cancel', 'message', 'offer-reply'],
  staff: ['update-settings', 'registration', 'confirm', 'return-documents', 'reject', 'accept-cancel', 'check-in', 'complete', 'message', 'assign', 'offer', 'expire-offer', 'resolve-incident', 'close-day', 'reopen-day', 'capacity'],
};

export class FacilityService {
  constructor(repository, { facilityId, documentStore, now = () => new Date().toISOString() }) {
    need(typeof facilityId === 'string' && facilityId.length > 0, '施設設定が必要です。', 503);
    this.repo = repository;
    this.facilityId = facilityId;
    this.key = `facility-v1:${facilityId}`;
    this.documents = documentStore;
    this.now = now;
  }
  // Every read and write sees the current time as s.clock.
  async state() { const { state } = await this.repo.read(this.key); state.clock = this.now(); return state; }
  archived(filter = {}) { return this.repo.listArchivedBookings({ ...filter, key: this.key }); }
  change(fn, options) { return this.repo.change(this.key, s => { s.clock = this.now(); return fn(s); }, options); }

  // Creates the facility aggregate with default house rules. Idempotent.
  async initialize({ name, municipality = '' }) {
    return this.change(s => {
      if (s.facilityId) { need(s.facilityId === this.facilityId, '施設が一致しません。', 409); return { ok: true, repeated: true }; }
      s.facilityId = this.facilityId; s.memberships = []; s.documentVersions = []; s.settingsHistory = [];
      s.settings = validateSettings({ ...DEFAULT_SETTINGS, profile: { ...DEFAULT_SETTINGS.profile, name, municipality } });
      audit(s, 'system', '施設を作成', this.facilityId);
      return { ok: true };
    });
  }
  // Organization owners act as administrators of every facility. Their membership is
  // created on first use so audit, assignment and staff lists stay uniform.
  async ensureOwner(subject, { name, email } = {}) {
    const s = await this.state();
    this.checkFacility(s);
    if (s.memberships.some(m => m.subject === subject && m.role === 'staff' && m.active && m.permission === 'admin')) return;
    await this.change(current => {
      const member = current.memberships.find(m => m.subject === subject && m.role === 'staff');
      if (member) { if (member.active && member.permission === 'admin') return; member.active = true; member.permission = 'admin'; member.owner = true; member.version++; }
      else current.memberships.push({ id: uuid(), subject, role: 'staff', permission: 'admin', owner: true, active: true, version: 1, name: name || '本部', email: email || '' });
      audit(current, subject, '本部として施設の管理を開始', this.facilityId);
    });
  }
  checkFacility(s) { need(s.facilityId === this.facilityId, '施設の初期設定が必要です。職員画面から初期管理者を登録してください。', 503); }
  actor(s, subject, role) {
    this.checkFacility(s);
    need(typeof subject === 'string' && subject.length > 0, '本人確認が必要です。', 401);
    const member = s.memberships.find(m => m.subject === subject && m.role === role && m.active);
    need(member, 'この施設での操作権限がありません。', 403);
    if (role === 'staff') return { id: member.id, role, permission: member.permission, subject, name: member.name };
    const account = s.accounts.find(a => a.id === member.householdId);
    need(account, '家庭登録が見つかりません。', 403);
    return { ...account, role, subject };
  }
  async openHousehold(subject, email = '') {
    need(typeof subject === 'string' && subject.length > 0, '本人確認が必要です。', 401);
    const known = (await this.state()).memberships?.find(m => m.subject === subject && m.role === 'parent');
    if (known?.active) return { ok: true, id: known.householdId, repeated: true };
    return this.change(s => {
      this.checkFacility(s);
      const existing = s.memberships.find(m => m.subject === subject && m.role === 'parent');
      if (existing) { need(existing.active, '利用権限が停止されています。施設へご連絡ください。', 403); return { ok: true, id: existing.householdId, repeated: true }; }
      const householdId = uuid();
      s.accounts.push({ id: householdId, complete: false, email });
      s.memberships.push({ id: uuid(), subject, role: 'parent', householdId, active: true, version: 1 });
      audit(s, subject, '家庭登録を開始', householdId);
      return { ok: true, id: householdId };
    });
  }
  async staffMembership(subject, { memberId, permission, active, version }) {
    return this.change(s => {
      const actor = this.actor(s, subject, 'staff');
      need(actor.permission === 'admin', '職員の管理権限がありません。', 403);
      need(['admin', 'operator'].includes(permission) && typeof active === 'boolean', '権限設定を確認してください。', 400);
      const member = s.memberships.find(m => m.id === memberId && m.role === 'staff');
      need(member, '職員が見つかりません。', 404); revise(member, version);
      if (member.active && member.permission === 'admin' && (!active || permission !== 'admin'))
        need(s.memberships.some(m => m.id !== member.id && m.active && m.role === 'staff' && m.permission === 'admin'), '最後の管理者は解除できません。', 409);
      member.permission = permission; member.active = active; member.version++;
      audit(s, actor.id, active ? '職員権限を設定' : '職員権限を停止', member.id);
      return { ok: true, id: member.id, version: member.version, subject: member.subject };
    });
  }
  async acceptStaffInvitation(targetSubject, { permission, name, email, invitationId }) {
    need(typeof targetSubject === 'string' && targetSubject.length > 0, '職員本人の確認が必要です。', 401);
    need(['admin', 'operator'].includes(permission), '招待の権限設定が不正です。', 400);
    return this.change(s => {
      this.checkFacility(s);
      need(!s.memberships.some(m => m.subject === targetSubject && m.role === 'staff'), '登録済みの職員です。', 409);
      const member = { id: uuid(), subject: targetSubject, role: 'staff', permission, active: true, version: 1, name: name || '職員', email: email || '' };
      s.memberships.push(member);
      audit(s, member.id, '職員招待を使用して利用開始', invitationId);
      return { ok: true, id: member.id };
    });
  }
  staffAdmin(s, subject) { const actor = this.actor(s, subject, 'staff'); need(actor.permission === 'admin', '管理権限がありません。', 403); return actor; }
  booking(s, actor, bookingId) {
    const booking = s.bookings.find(b => b.id === bookingId && (actor.role === 'staff' || b.owner === actor.id));
    need(booking, '予約が見つかりません。', 404); return booking;
  }
  project(s, role, b) {
    return {
      ...publicBooking(b),
      offerExpiresAt: b.offerExpiresAt || null,
      documents: (s.documentVersions || []).filter(d => d.bookingId === b.id).map(d => ({ id: d.id, kind: d.kind, revision: d.revision, submittedAt: d.submittedAt, active: d.active, reviewedAt: d.reviewedAt || null, contentType: d.contentType || '' })),
      ...(role === 'staff' ? { room: b.room || null, group: b.group || null, assignee: b.assignee || null, dueAt: b.dueAt || null, needsOfferConsent: !!b.needsOfferConsent, owner: b.owner } : {}),
    };
  }
  async read(subject, role) {
    const s = await this.state(), actor = this.actor(s, subject, role);
    const children = s.children.filter(c => role === 'staff' || c.owner === actor.id).map(c => ({ ...publicChild(c), ...(role === 'staff' ? { owner: c.owner } : {}) }));
    const bookings = s.bookings.filter(b => role === 'staff' || b.owner === actor.id).map(b => this.project(s, role, b));
    const result = { facilityId: this.facilityId, clock: s.clock, children, bookings, settings: settingsOf(s) };
    if (role === 'parent') return snapshot({ ...result, user: { complete: actor.complete, householdId: actor.id }, availability: actor.complete ? availabilityList(s) : [] });
    const today = jstDate(s.clock);
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i)).map(date => ({ date, closure: closureOf(s, date), capacity: capacityOf(s, date), held: s.bookings.filter(b => b.date === date && held(b)).length }));
    return snapshot({ ...result, permission: actor.permission, me: actor.id, tasks: this.tasks(s), audit: s.audit.slice(-100), closed: s.closed, days, settingsHistory: (s.settingsHistory || []).slice(-20),
      households: s.accounts.map(a => ({ id: a.id, email: a.email || '' })),
      staff: s.memberships.filter(m => m.role === 'staff').map(({ id, permission, active, version, name, email, owner }) => ({ id, permission, active, version, name: name || '職員', email: email || '', owner: !!owner })), dayCapacity: s.dayCapacity });
  }
  tasks(s) {
    const tasks = s.bookings.filter(b => !finished(b)).map(b => {
      const action = ({ pending: '申込み内容・書類・受入条件を確認', needs_documents: '書類の再提出を待つ', waitlisted: '受入枠と繰上げを検討', offer_pending: '繰上げの返答を確認', offer_accepted: '繰上げ希望後の受入再確認', cancel_requested: '取消し申出を確認', confirmed: '当日の受付', checked_in: 'お迎え確認・退室' })[b.status];
      const dueAt = b.offerExpiresAt || b.dueAt || new Date(at(b.date, b.status === 'checked_in' ? b.end : b.start)).toISOString();
      const assignee = b.assignee && s.memberships.some(m => m.id === b.assignee && m.active) ? b.assignee : null;
      return { id: b.id, bookingId: b.id, action, assignee, dueAt, overdue: Date.parse(s.clock) >= Date.parse(dueAt) };
    });
    return [...tasks, ...s.incidents.filter(i => !i.resolved).map(i => ({ ...i, action: '休園中のお預かり・お迎え調整', overdue: Date.parse(s.clock) >= Date.parse(i.dueAt) }))]
      .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  }
  async command(subject, role, path, body) {
    need(COMMANDS[role]?.includes(path), '操作が見つかりません。', 404);
    return this.change(async s => {
      const actor = this.actor(s, subject, role);
      if (path === 'update-settings') {
        need(actor.permission === 'admin', '施設設定の管理権限がありません。', 403);
        const current = settingsOf(s);
        need(body.version === current.version, '設定が他の職員によって更新されています。画面を読み直してください。', 409);
        const next = validateSettings(body.settings, s.settings ? current : { ...current, version: 0 });
        const capacity = next.rooms.reduce((sum, r) => sum + r.capacity, 0);
        for (const [date, value] of Object.entries(s.dayCapacity)) if (value > capacity) s.dayCapacity[date] = capacity;
        s.settingsHistory = [...(s.settingsHistory || []), { version: current.version, at: s.clock, actor: actor.id, settings: current }].slice(-50);
        s.settings = next;
        audit(s, actor.id, `ハウスルールを変更（第${next.version}版）`, this.facilityId);
        return { ok: true, version: next.version };
      }
      if (['close-day', 'reopen-day', 'capacity'].includes(path)) {
        need(actor.permission === 'admin', '施設設定の管理権限がありません。', 403);
        const today = jstDate(s.clock);
        need(isCalendarDate(body.date) && body.date >= today && body.date <= addDays(today, 366), '今日から1年以内の日付を選択してください。', 400);
        const affected = s.bookings.filter(b => b.date === body.date && !finished(b));
        const changed = [];
        if (path === 'capacity') {
          const max = settingsOf(s).rooms.reduce((sum, r) => sum + r.capacity, 0);
          need(Number.isInteger(body.capacity) && body.capacity >= 0 && body.capacity <= max, `受入上限は0〜${max}名です。`, 400);
          need(affected.filter(held).length <= body.capacity, '確保中の枠を下回ります。先に個別対応を完了してください。', 409);
          s.dayCapacity[body.date] = body.capacity;
        } else if (path === 'reopen-day') {
          need(s.closed.includes(body.date), '休園設定されていません。', 409);
          s.closed = s.closed.filter(d => d !== body.date);
        } else {
          need(body.confirm === true, '対象日と予約への影響の確認が必要です。', 400);
          need(!s.closed.includes(body.date), '既に休園設定されています。', 409);
          const reason = text(body.reason, '休園の理由', 200, { required: false }) || '施設都合';
          s.closed.push(body.date);
          for (const b of affected) {
            b.reason = `休園（${reason}）`;
            if (b.status === 'checked_in') s.incidents.push({ id: uuid(), bookingId: b.id, date: b.date, dueAt: s.clock, resolved: false });
            else if (held(b)) b.status = 'cancel_requested'; // Hold until individual acknowledgement, even during closure.
            else b.status = 'rejected';
            b.offerExpiresAt = null;
            b.messages.push({ id: uuid(), at: s.clock, from: '施設', text: `${b.date}は休園となりました（${reason}）。詳しくは施設からの連絡をご確認ください。` });
            event(s, b, b.reason);
            changed.push(b.id);
          }
        }
        audit(s, actor.id, labels[path], body.date);
        return { ok: true, changed };
      }
      if (['assign', 'offer', 'offer-reply', 'expire-offer', 'resolve-incident'].includes(path)) {
        const b = this.booking(s, actor, body.id); revise(b, body.version);
        if (path === 'offer-reply') {
          need(b.status === 'offer_pending' && Date.parse(s.clock) < Date.parse(b.offerExpiresAt), '繰上げの返答期限を過ぎています。', 409);
          need(typeof body.accept === 'boolean', '返答を選択してください。', 400);
          b.status = body.accept ? 'offer_accepted' : 'cancelled';
          if (body.accept) b.needsOfferConsent = false; else { b.room = null; b.group = null; }
          b.offerExpiresAt = null;
          b.reason = body.accept ? '繰上げ希望を受付。職員の再確認待ち。' : '繰上げを辞退';
        } else if (path === 'assign') {
          need(!finished(b), '終了した予約には割り当てできません。', 409);
          need(s.memberships.some(m => m.id === body.assignee && m.active && m.role === 'staff'), '有効な職員を指定してください。', 400);
          need(Number.isFinite(Date.parse(body.dueAt)) && Date.parse(body.dueAt) > Date.parse(s.clock) && Date.parse(body.dueAt) <= at(b.date, b.end), '期限は現在より後・利用終了予定までにしてください。', 400);
          b.assignee = body.assignee; b.dueAt = new Date(Date.parse(body.dueAt)).toISOString();
        } else if (path === 'resolve-incident') {
          const incident = s.incidents.find(i => i.id === body.incidentId && i.bookingId === b.id && !i.resolved);
          need(incident && body.checked === true, '対応記録と確認が必要です。', 400);
          need(b.status === 'completed', '退室の確認を先に完了してください。', 409);
          incident.resolved = true;
        } else if (path === 'expire-offer') {
          need(b.status === 'offer_pending' && Date.parse(s.clock) >= Date.parse(b.offerExpiresAt), '返答期限前の繰上げです。', 409);
          b.status = 'waitlisted'; b.offerExpiresAt = null; b.room = null; b.group = null;
        } else {
          need(['waitlisted', 'pending'].includes(b.status) && b.needsOfferConsent, '繰上げ意思確認の対象ではありません。', 409);
          need(!closureOf(s, b.date), '休園日の繰上げはできません。', 409);
          need(Number.isFinite(Date.parse(body.expiresAt)) && Date.parse(body.expiresAt) > Date.parse(s.clock) && Date.parse(body.expiresAt) <= at(b.date, b.end), '返答期限を確認してください。', 400);
          // Apply all normal capacity, registration, document and staff checks atomically.
          const candidate = snapshot(s);
          await executeBusiness(candidate, actor, 'confirm', { ...body, id: b.id, version: b.version });
          const allocation = candidate.bookings.find(x => x.id === b.id);
          const child = s.children.find(x => x.id === b.childId);
          if (child.status !== 'approved') {
            revise(child, body.registrationVersion);
            need(body.registrationChecked === true, '利用者情報・緊急連絡先・対象条件を確認してください。', 400);
            child.status = 'approved'; child.reason = ''; child.version++;
            audit(s, actor.id, '繰上げ審査時に利用者情報を承認', child.id);
          }
          b.room = allocation.room; b.group = allocation.group;
          b.status = 'offer_pending'; b.offerExpiresAt = new Date(Date.parse(body.expiresAt)).toISOString();
        }
        event(s, b, path === 'offer' ? '繰上げ意思確認（未確定・枠を仮確保）' : path === 'offer-reply' ? b.reason : labels[path]);
        audit(s, actor.id, labels[path], b.id);
        return { ok: true, owner: b.owner, status: b.status };
      }
      if (path === 'confirm') {
        const b = this.booking(s, actor, body.id);
        need(b.status !== 'waitlisted' && !b.needsOfferConsent, '先に保護者へ繰上げ意思を確認してください。', 409);
      }
      const result = await executeBusiness(s, actor, path, body);
      const b = body.id && s.bookings.find(x => x.id === (result.id || body.id));
      if (path === 'confirm') for (const doc of (s.documentVersions || []).filter(d => d.bookingId === body.id && d.active)) { doc.reviewedAt = s.clock; doc.reviewedBy = actor.id; }
      return { ...result, ...(b && !result.owner ? { owner: b.owner, status: b.status } : {}) };
    });
  }
  // files: [{kind:'physician'|'medicine', bytes:Uint8Array, contentType, ext}]
  async submitDocuments(subject, { id, version, files }) {
    need(this.documents, '書類の保存先が未接続です。', 503);
    const before = await this.state(), actor = this.actor(before, subject, 'parent');
    const booking = this.booking(before, actor, id); revise(booking, version);
    need(['pending', 'needs_documents', 'waitlisted', 'confirmed', 'offer_accepted'].includes(booking.status), 'この状態では書類を変更できません。', 409);
    need(Array.isArray(files) && files.length > 0, '書類を添付してください。', 400);
    const kinds = files.map(f => f.kind);
    need(new Set(kinds).size === kinds.length && kinds.every(k => k in DOCUMENT_KINDS), '書類の種類を確認してください。', 400);
    need(kinds.includes('physician'), '医師連絡票を添付してください。', 400);
    need(!booking.medication || !settingsOf(before).requireMedicineDoc || kinds.includes('medicine'), '服薬ありの場合、与薬依頼書も必要です。', 400);
    const planned = files.filter(f => f.kind !== 'medicine' || booking.medication).map(file => {
      const documentId = uuid();
      return { ...file, id: documentId, key: `${this.facilityId}/${id}/${documentId}.${file.ext}` };
    });
    // Track every attempted key: a failed response may follow a successful upload.
    // Wait for ALL uploads before recovery so a late success cannot escape tracking.
    // Never delete here: a lost commit response may mean the files are referenced.
    try {
      const uploads = await Promise.allSettled(planned.map(file => this.documents.put(file.key, file.bytes, file.contentType)));
      const failed = uploads.find(result => result.status === 'rejected');
      if (failed) throw failed.reason;
      return await this.change(async s => {
        const current = this.actor(s, subject, 'parent');
        await executeBusiness(s, current, 'documents', { id, version, physician: true, medicineDoc: planned.some(f => f.kind === 'medicine') });
        for (const file of planned) {
          const previous = s.documentVersions.filter(d => d.bookingId === id && d.kind === file.kind);
          previous.forEach(d => { d.active = false; });
          s.documentVersions.push({ id: file.id, key: file.key, kind: file.kind, contentType: file.contentType, bookingId: id, revision: previous.length + 1, active: true, submittedBy: current.id, submittedAt: s.clock });
        }
        return { ok: true, owner: current.id };
      });
    } catch (error) {
      try { await this.documents.quarantine?.(planned.map(file => file.key), subject); }
      catch {
        const recovery = new Fault(503, '書類の保存結果を確認できません。再送前に最新情報を確認し、施設へ保存状態の確認を依頼してください。');
        recovery.code = 'DOCUMENT_RECOVERY_REQUIRED';
        throw recovery;
      }
      throw error;
    }
  }
  async readDocument(subject, role, documentId) {
    need(this.documents, '書類の保存先が未接続です。', 503);
    const s = await this.state(), actor = this.actor(s, subject, role);
    const doc = (s.documentVersions || []).find(d => d.id === documentId);
    need(doc, '書類が見つかりません。', 404); this.booking(s, actor, doc.bookingId);
    const bytes = await this.documents.get(doc.key);
    need(bytes, '書類を読み込めません。', 503);
    await this.change(current => {
      const liveActor = this.actor(current, subject, role); this.booking(current, liveActor, doc.bookingId);
      audit(current, liveActor.id, '書類を閲覧', doc.id);
    });
    return { bytes, contentType: doc.contentType || 'application/octet-stream', name: `${DOCUMENT_KINDS[doc.kind] || '書類'}_第${doc.revision}版` };
  }
}

export { STATUSES };
