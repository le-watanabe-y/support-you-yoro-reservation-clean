/* eslint-disable @typescript-eslint/no-explicit-any -- API projections are runtime-validated by the server boundary. */
"use client";
import { useMemo, useState } from 'react';
import { LineSetup } from '../line-setup';
import { AccountForm, StaffExtras, Tasks, FacilityCalendar, StaffAdmin, ExportPanel, DocumentLinks } from '../controls';
import { TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Details, GuidedForm as Form, Reveal, WorkflowTabs as Tabs, revealById } from '../interaction';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Frame, Panel, Pick, Check, Button, Text, LongText, Blank, Badge, Feedback, dateLabel, clockLabel, values, templates, type Api } from '../ui';

const WAITING = ['pending', 'needs_documents', 'waitlisted', 'cancel_requested', 'offer_pending', 'offer_accepted'];

function ChildFacts({ c }: { c: any }) {
  return <dl className="facts"><div><dt>お子さま</dt><dd>{c?.name}（{c?.kana}）<br />{c?.birth} 生</dd></div><div><dt>保護者・連絡先</dt><dd>{c?.guardian}<br /><a href={`tel:${c?.phone}`}>{c?.phone}</a></dd></div><div><dt>緊急連絡先</dt><dd>{c?.emergencyName}<br /><a href={`tel:${c?.emergencyPhone}`}>{c?.emergencyPhone}</a></dd></div><div><dt>お迎え可能な方</dt><dd>{c?.guardian}{c?.pickup && <><br />{c.pickup}</>}</dd></div><div><dt>アレルギー</dt><dd>{c?.allergy}</dd></div><div><dt>既往歴・かかりつけ医</dt><dd>{c?.history}</dd></div></dl>;
}

function Review({ b, api }: { b: any, api: Api }) {
  const s = api.state, c = s.children.find((c: any) => c.id === b.childId), [action, setAction] = useState('');
  return <article id={`booking-${b.id}`} className="booking"><div className="booking-head"><div><p className="eyebrow">{dateLabel(b.date)} · {b.start}–{b.end}</p><h3>{c?.name}</h3><p>{c?.guardian}</p></div><Badge status={b.status}>{b.label}</Badge></div>
    <dl className="facts"><div><dt>利用登録</dt><dd>{c?.status === 'approved' ? '確認済み' : c?.status === 'returned' ? '差戻し中' : 'この予約と一緒に確認'}</dd></div><div><dt>症状</dt><dd>{b.symptom}</dd></div>{b.notes && <div><dt>保護者からの連絡事項</dt><dd>{b.notes}</dd></div>}<div><dt>必要書類</dt><dd>医師連絡票：{b.physician ? '提出済み' : '未提出'}{b.medication && ` / 与薬依頼書：${b.medicineDoc ? '提出済み' : '未提出'}`}</dd></div><div><dt>保育室・感染区分</dt><dd>{b.room ? `${b.room}室 / ${b.group}` : '未割当て'}</dd></div>{b.checkedInAt && <div><dt>入室・退室</dt><dd>{clockLabel(b.checkedInAt)}{b.completedAt && ` 〜 ${clockLabel(b.completedAt)}`}</dd></div>}{b.fee !== null && <div><dt>利用料金（減免前）</dt><dd>{b.fee.toLocaleString()}円 / お迎え：{b.pickup}</dd></div>}</dl>
    <DocumentLinks b={b} staff />
    <Details><summary>利用者情報の詳細</summary><ChildFacts c={c} />{c?.status === 'pending' && <div className="actions"><Button variant="outline" onClick={() => { setAction('registration'); revealById(`staff-action-${b.id}`); }}>利用登録を差し戻す</Button></div>}</Details>
    {b.reason && <p className="error">{b.reason}</p>}
    {['pending', 'offer_accepted'].includes(b.status) && !b.needsOfferConsent && <Details><summary>申込みを確認・予約を確定</summary><Form onSubmit={e => { e.preventDefault(); const f = values(e.currentTarget); api.act('confirm', { id: b.id, version: b.version, registrationVersion: c?.version, registrationChecked: f.registrationChecked === 'yes', room: f.room, group: f.group, medical: f.medical === 'yes', infection: f.infection === 'yes', staffing: f.staffing === 'yes' }, '予約を確定しました。保護者へお知らせしました。'); }}><fieldset disabled={api.busy}>{c?.status !== 'approved' && <Check name="registrationChecked">利用者情報・緊急連絡先・対象条件を確認した</Check>}<Check name="medical">医師連絡票と当日の利用条件を確認した</Check><Check name="infection">感染区分と同室の可否を確認した</Check><Check name="staffing">保育・看護の職員体制を確認した</Check><div className="form-grid"><Pick name="room" label="保育室" items={s.rules.rooms} /><Pick name="group" label="感染区分" items={s.rules.groups} /></div><p className="hint">1日{s.rules.dailyCapacity}名・各室{s.rules.roomCapacity}名まで。同じ室には同じ感染区分のお子さまのみ配置できます。</p><Button type="submit">確認して予約を確定</Button></fieldset></Form></Details>}
    {['pending', 'needs_documents', 'waitlisted', 'confirmed', 'offer_pending', 'offer_accepted'].includes(b.status) && <div className="actions"><Button variant="outline" onClick={() => { setAction('return-documents'); revealById(`staff-action-${b.id}`); }}>書類を差し戻す</Button><Button variant="outline" onClick={() => { setAction('reject'); revealById(`staff-action-${b.id}`); }}>受入不可にする</Button></div>}
    {action && <Reveal key={action} id={`staff-action-${b.id}`} title={{ reject: '受入不可の理由', 'return-documents': '書類差戻しの理由', registration: '利用登録の差戻し理由' }[action]}><Form onSubmit={async e => { e.preventDefault(); const f = values(e.currentTarget); const ok = action === 'registration' ? await api.act('registration', { id: c.id, version: c.version, status: 'returned', reason: f.reason }, '利用登録を差し戻しました。保護者へお知らせしました。') : await api.act(action, { id: b.id, version: b.version, reason: f.reason }, '理由を保存し、保護者へお知らせしました。'); if (ok) setAction(''); }}><fieldset disabled={api.busy}><LongText name="reason" label="理由（保護者に表示されます）" maxLength={500} templates={templates.reasons} /><p className="hint">確定済みの場合は確定と保育室の割当てを解除します。</p><div className="actions"><Button variant="outline" onClick={() => setAction('')}>戻る</Button><Button type="submit">理由を添えて保存</Button></div></fieldset></Form></Reveal>}
    {b.status === 'cancel_requested' && <Form onSubmit={e => { e.preventDefault(); api.act('accept-cancel', { id: b.id, version: b.version }, '取消しを完了し、枠を解放しました。'); }}><fieldset disabled={api.busy}><p className="note">保護者から取消し申出があります。確認するまで枠を保持しています。</p><Button type="submit">取消しを完了する</Button></fieldset></Form>}
    {b.status === 'confirmed' && <Form onSubmit={e => { e.preventDefault(); const f = values(e.currentTarget); api.act('check-in', { id: b.id, version: b.version, checked: f.checked === 'yes' }, '入室を記録しました。'); }}><fieldset disabled={api.busy}><Check name="checked">本人・当日の体調・持ち物を確認した</Check><Button type="submit">入室を記録</Button></fieldset></Form>}
    {b.status === 'checked_in' && <Form onSubmit={e => { e.preventDefault(); const f = values(e.currentTarget); api.act('complete', { id: b.id, version: b.version, checked: f.checked === 'yes', pickup: f.pickup }, '退室を記録しました。'); }}><fieldset disabled={api.busy}><Text label="お迎えの方" name="pickup" defaultValue={c?.guardian} maxLength={40} hint={c?.pickup ? `登録済み：${c.guardian}、${c.pickup}` : `登録済み：${c?.guardian}`} /><Check name="checked">登録済みのお迎えの方であることを確認した</Check><Button type="submit">退室を記録</Button></fieldset></Form>}
    <StaffExtras b={b} api={api} />
    <Details><summary>連絡・操作履歴（{b.messages.length}件の連絡）</summary>{b.events.map((x: any, i: number) => <p key={i} className="history-row"><time>{clockLabel(x.at)}</time>{x.label}</p>)}{b.messages.map((m: any) => <div key={m.id} className="message"><strong>{m.from}</strong><span>{clockLabel(m.at)}</span><p>{m.text}</p></div>)}{!['cancelled', 'rejected', 'completed'].includes(b.status) && <Form onSubmit={async e => { e.preventDefault(); const form = e.currentTarget, f = values(form); if (await api.act('message', { id: b.id, version: b.version, message: f.message }, '保護者へ連絡しました。')) form.reset(); }}><fieldset disabled={api.busy}><LongText name="message" label="保護者への連絡" maxLength={500} templates={templates.staffMessages} /><Button variant="outline" type="submit">連絡を送る</Button></fieldset></Form>}</Details>
  </article>;
}

export default function StaffView({ api }: { api: Api }) {
  const s = api.state; const [filter, setFilter] = useState('対応待ち'), [date, setDate] = useState('全日');
  const dates = useMemo(() => Array.from(new Set<string>((s?.bookings || []).map((b: any) => b.date))).sort(), [s?.bookings]);
  const today = s?.clock ? new Date(Date.parse(s.clock) + 9 * 3600000).toISOString().slice(0, 10) : '';
  const bookings = s?.bookings?.filter((b: any) => (date === '全日' || b.date === date) && (filter === 'すべて' || filter === '対応待ち' && WAITING.includes(b.status) || filter === '本日' && b.date === today || filter === '確定・利用中' && ['confirmed', 'checked_in'].includes(b.status) || filter === '終了分' && ['cancelled', 'rejected', 'completed'].includes(b.status))).sort((a: any, b: any) => (a.date + a.start).localeCompare(b.date + b.start)) || [];
  const todays = s?.bookings?.filter((b: any) => b.date === today && ['confirmed', 'checked_in', 'completed'].includes(b.status)) || [];
  return <Frame staff authenticated={s?.authenticated} onLogout={() => api.act('logout', {}, 'ログアウトしました。')}>
    <Feedback api={api} />
    {!s ? (!api.error && <p role="status">読み込んでいます…</p>) : !s.authenticated ? <div className="staff-entry"><AccountForm key={String(s.setupAvailable)} api={api} staff /></div> : <>
      <div className="page-title"><div><p className="eyebrow">職員用 · {s.staff.find((m: any) => m.id === s.me)?.name}</p><h1>受付とお預かりの管理</h1></div><Button variant="outline" disabled={api.busy} onClick={api.refresh}>最新情報に更新</Button></div>
      <div className="stats">
        <div><span>対応待ち</span><strong>{s.bookings.filter((b: any) => WAITING.includes(b.status)).length}<small>件</small></strong></div>
        <div><span>本日のお預かり</span><strong>{todays.filter((b: any) => b.status === 'checked_in').length}<small>名在室 / 予定{todays.length}名</small></strong></div>
        <div><span>本日の受入上限</span><strong>{s.days[0]?.closure ? '休園' : <>{s.days[0]?.capacity}<small>名</small></>}</strong></div>
      </div>
      <Tabs defaultValue="reservations"><TabsList className="main-tabs"><TabsTrigger value="reservations">予約管理</TabsTrigger><TabsTrigger value="calendar">開園日・出力</TabsTrigger><TabsTrigger value="audit">操作履歴</TabsTrigger><TabsTrigger value="settings">職員・設定</TabsTrigger></TabsList>
        <TabsContent value="reservations"><Tasks api={api} onOpen={id => { setFilter('すべて'); setDate('全日'); revealById(`booking-${id}`); }} /><Panel title="予約の確認"><div className="form-grid"><Pick name="filter" label="状態で絞り込み" value={filter} onChange={value => { setFilter(value); revealById('staff-results'); }} items={['対応待ち', '本日', '確定・利用中', '終了分', 'すべて']} /><Pick name="date" label="利用日で絞り込み" value={date} onChange={value => { setDate(value); revealById('staff-results'); }} items={[{ value: '全日', label: '全日' }, ...dates.map(d => ({ value: d, label: dateLabel(d) }))]} /></div><p id="staff-results" tabIndex={-1} role="status" className="results-count">{filter} · {date === '全日' ? '全日' : dateLabel(date)}：{bookings.length}件</p>{bookings.length ? bookings.map((b: any) => <Review key={b.id} b={b} api={api} />) : <Blank title="該当する予約はありません" description="保護者が申込みを送信すると、ここに表示されます。" />}</Panel></TabsContent>
        <TabsContent value="calendar"><FacilityCalendar api={api} /><ExportPanel /></TabsContent>
        <TabsContent value="audit"><Panel title="操作履歴（直近100件）"><p className="hint">誰がいつ何を操作したかを記録しています。</p><Table><TableHeader><TableRow><TableHead>日時</TableHead><TableHead>操作者</TableHead><TableHead>操作</TableHead></TableRow></TableHeader><TableBody>{s.audit.slice().reverse().map((a: any) => { const staff = s.staff.find((m: any) => m.id === a.actor); const household = s.households.find((h: any) => h.id === a.actor); return <TableRow key={a.id}><TableCell>{clockLabel(a.recordedAt || a.at)}</TableCell><TableCell>{staff ? `職員 ${staff.name}` : household ? `保護者 ${household.email}` : '保護者'}</TableCell><TableCell>{a.event}</TableCell></TableRow>; })}</TableBody></Table></Panel></TabsContent>
        <TabsContent value="settings"><StaffAdmin api={api} />{s.permission === 'admin' && <LineSetup />}</TabsContent>
      </Tabs>
    </>}
  </Frame>;
}
