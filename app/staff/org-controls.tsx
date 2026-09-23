/* eslint-disable @typescript-eslint/no-explicit-any -- API projections are runtime-validated by the server boundary. */
"use client";
// Multi-facility controls: facility switcher, headquarters (owner) management,
// joining another facility by invitation code, and the per-facility house-rule form.
import { useState, type ReactNode } from 'react';
import { Panel, Button, Input, Pick, Field, Text, Confirm, values, clockLabel, type Api } from '../ui';
import { GuidedForm as Form, Reveal } from '../interaction';
import { validateSettings, WEEKDAYS, hoursText, feeText, ageText, momentText } from '@/lib/settings.mjs';

export function FacilitySwitcher({ api, facility, onChange }: { api: Api, facility: string, onChange: (id: string) => void }) {
  const list = api.state?.facilities || [];
  if (list.length < 2) return null;
  return <div className="facility-switcher"><Pick name="facility" label="表示する施設" value={facility} onChange={onChange} items={list.map((f: any) => ({ value: f.id, label: `${f.name}${f.active === false ? '（停止中）' : ''}` }))} /></div>;
}

export function JoinPanel({ api, onJoined }: { api: Api, onJoined: (id: string) => void }) {
  return <Panel title="招待コードで施設を追加"><p className="hint">別の施設や本部から招待コードを受け取った場合は、ここに入力すると、このアカウントのまま利用できるようになります。</p>
    <Form onSubmit={async e => { e.preventDefault(); const form = e.currentTarget, f = values(form); const r = await api.act('join', { code: f.code }, '招待を受け付けました。'); if (r) { form.reset(); if (r.facilityId) onJoined(r.facilityId); } }}><fieldset disabled={api.busy}><Text label="招待コード" name="code" minLength={10} maxLength={64} autoCapitalize="none" spellCheck={false} /><Button variant="outline" type="submit">追加する</Button></fieldset></Form>
  </Panel>;
}

export function Headquarters({ api, onOpen }: { api: Api, onOpen: (id: string) => void }) {
  const s = api.state, [invite, setInvite] = useState<any>(null);
  if (!s?.owner) return null;
  return <>
    <Panel title="施設の一覧（本部）">
      <div className="table-scroll"><table className="simple-table"><thead><tr><th>施設</th><th>市町村</th><th>ID・保護者用URL</th><th>状態</th><th></th></tr></thead><tbody>{s.facilities.map((f: any) => <tr key={f.id}><td><button type="button" className="link-button" onClick={() => onOpen(f.id)}>{f.name}</button></td><td>{f.municipality}</td><td>/f/{f.id}</td><td>{f.active ? '受付中' : '停止中'}</td><td><Confirm label={f.active ? '受付を停止' : '受付を再開'} description={f.active ? '保護者の画面からこの施設が見えなくなり、新しい申込みもできなくなります。職員画面とデータはそのまま残ります。' : '保護者が再びこの施設を選べるようになります。'} onConfirm={() => api.act('facility-active', { id: f.id, active: !f.active }, f.active ? '受付を停止しました。' : '受付を再開しました。')} /></td></tr>)}</tbody></table></div>
      <h3>施設を追加</h3>
      <Form onSubmit={async e => { e.preventDefault(); const form = e.currentTarget, f = values(form); const r = await api.act('facility-create', { id: f.id, name: f.name, municipality: f.municipality }, '施設を追加しました。ハウスルールを設定してください。'); if (r) { form.reset(); onOpen(r.id); } }}><fieldset disabled={api.busy}><div className="form-grid"><Text label="施設名" name="name" maxLength={60} placeholder="例：病児保育室 Support you 大垣" /><Text label="市町村" name="municipality" required={false} maxLength={40} placeholder="例：大垣市" /></div><Text label="施設ID（URLに使う半角英数字）" name="id" pattern="[a-z0-9][a-z0-9-]{1,30}" maxLength={31} placeholder="例：ogaki" autoCapitalize="none" spellCheck={false} hint="保護者用のURLが /f/施設ID になります。後から変更できません。" /><p className="hint">追加した施設には標準のハウスルールが入ります。追加後に「ハウスルール」タブで、その自治体の実施要綱に合わせて変更してください。</p><Button type="submit">施設を追加</Button></fieldset></Form>
    </Panel>
    <Panel title="本部の管理者">
      <p>{(s.owners || []).map((o: any) => o.email).join('、')}</p>
      <p className="hint">本部の管理者は、すべての施設の管理者として操作できます。</p>
      <Form onSubmit={async e => { e.preventDefault(); const form = e.currentTarget, f = values(form); const r = await api.act('owner-invite', { name: f.name, email: f.email, sendEmail: f.sendEmail === 'yes' }, '招待コードを発行しました。'); if (r) { setInvite(r); form.reset(); } }}><fieldset disabled={api.busy}><div className="form-grid"><Text label="氏名" name="name" maxLength={40} /><Text label="メールアドレス" name="email" type="email" maxLength={254} autoCapitalize="none" /></div>{s.mailConfigured && <label className="check"><input type="checkbox" name="sendEmail" value="yes" defaultChecked /> <span>招待コードをメールでも送る</span></label>}<Button variant="outline" type="submit">本部管理者を招待</Button></fieldset></Form>
      {invite && <Reveal><div className="notice"><strong>招待コード（この画面でのみ表示）</strong><code className="recovery">{invite.code}</code><p>有効期限：{clockLabel(invite.expiresAt)}。{invite.mailed ? '招待メールを送信しました。' : '本人へ直接お伝えください。'}</p><Button variant="outline" onClick={() => setInvite(null)}>閉じる</Button></div></Reveal>}
      {s.ownerInvites?.map((x: any) => <div key={x.id} className="child"><span>{x.name}（{x.email}） / 本部管理者 / 期限 {clockLabel(x.expires_at)}</span><Confirm label="招待を取消し" description="この招待コードは使えなくなります。" onConfirm={() => api.act('owner-invite-revoke', { id: x.id }, '招待を取り消しました。')} /></div>)}
    </Panel>
  </>;
}

const clone = (x: any) => JSON.parse(JSON.stringify(x));
function Row({ children }: { children: ReactNode }) { return <div className="form-grid">{children}</div>; }
function Toggle({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean) => void }) { return <label className="check"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span>{label}</span></label>; }
function Moment({ label, value, onChange }: { label: string, value: any, onChange: (v: any) => void }) {
  return <Field label={label}><div className="inline-fields"><Input type="number" min={0} max={30} aria-label={`${label}（何日前）`} value={value.daysBefore} onChange={e => onChange({ ...value, daysBefore: Number(e.target.value) })} /><span>日前の</span><Input type="time" aria-label={`${label}（時刻）`} value={value.time} onChange={e => onChange({ ...value, time: e.target.value })} /></div></Field>;
}

export function SettingsForm({ api }: { api: Api }) {
  const s = api.state, [draft, setDraft] = useState<any>(() => clone(s.settings));
  const set = (patch: any) => setDraft((d: any) => ({ ...d, ...patch }));
  const profile = (patch: any) => set({ profile: { ...draft.profile, ...patch } });
  if (s.permission !== 'admin') return <Panel title="ハウスルール"><p>{hoursText(s.settings)}</p><p className="hint">ハウスルールの変更は、この施設の管理者または本部が行います。</p></Panel>;
  let preview: any = null, problem = '';
  try { preview = validateSettings(draft, s.settings); } catch (e: any) { problem = e?.message || '入力内容を確認してください。'; }
  return <Panel title={`ハウスルール（第${s.settings.version}版）`}>
    <p className="note">この施設だけに適用されます。自治体の実施要綱・委託契約に合わせて設定してください。保存すると新しい申込みから反映され、変更前の内容は履歴に残ります。確定済みの予約の時間・部屋は変わりません。</p>
    <h3>施設の情報</h3>
    <Row><Text label="施設名" name="p-name" value={draft.profile.name} onChange={e => profile({ name: e.target.value })} maxLength={60} /><Text label="市町村" name="p-municipality" required={false} value={draft.profile.municipality} onChange={e => profile({ municipality: e.target.value })} maxLength={40} /></Row>
    <Row><Text label="電話番号" name="p-phone" required={false} value={draft.profile.phone} onChange={e => profile({ phone: e.target.value })} maxLength={20} /><Text label="通知を受け取るメール" name="p-email" required={false} type="email" value={draft.profile.email} onChange={e => profile({ email: e.target.value })} maxLength={254} hint="新しい申込み・書類提出・取消し申出などを受け取ります。" /></Row>
    <Text label="住所" name="p-address" required={false} value={draft.profile.address} onChange={e => profile({ address: e.target.value })} maxLength={120} />
    <h3>開所日</h3>
    <div className="weekday-grid">{WEEKDAYS.map((w, i) => <Toggle key={w} label={`${w}曜`} checked={draft.openWeekdays.includes(i)} onChange={v => set({ openWeekdays: v ? [...draft.openWeekdays, i].sort() : draft.openWeekdays.filter((d: number) => d !== i) })} />)}</div>
    <Toggle label="祝日は休園" checked={draft.closeOnHolidays} onChange={v => set({ closeOnHolidays: v })} />
    <Toggle label="年末年始は休園" checked={draft.yearEndClosure.enabled} onChange={v => set({ yearEndClosure: { ...draft.yearEndClosure, enabled: v } })} />
    {draft.yearEndClosure.enabled && <Row><Text label="年末年始の休園開始（月-日）" name="ye-from" value={draft.yearEndClosure.from} onChange={e => set({ yearEndClosure: { ...draft.yearEndClosure, from: e.target.value } })} placeholder="12-29" /><Text label="年末年始の休園終了（月-日）" name="ye-to" value={draft.yearEndClosure.to} onChange={e => set({ yearEndClosure: { ...draft.yearEndClosure, to: e.target.value } })} placeholder="01-03" /></Row>}
    <h3>時間</h3>
    <Row><Text label="来園できる時刻（カンマ区切り）" name="arrival" value={Array.isArray(draft.arrivalTimes) ? draft.arrivalTimes.join(', ') : draft.arrivalTimes} onChange={e => set({ arrivalTimes: e.target.value })} placeholder="08:30, 09:00" /><Text label="お迎えの時刻（カンマ区切り）" name="end" value={Array.isArray(draft.endTimes) ? draft.endTimes.join(', ') : draft.endTimes} onChange={e => set({ endTimes: e.target.value })} placeholder="12:00, 17:00" /></Row>
    <Text label="来園予定の何分前から入室を受け付けるか" name="early" type="number" min={0} max={120} value={draft.checkInEarlyMinutes} onChange={e => set({ checkInEarlyMinutes: Number(e.target.value) })} />
    <h3>受付とキャンセル</h3>
    <Row><Moment label="受付開始（利用日の）" value={draft.bookingOpens} onChange={v => set({ bookingOpens: v })} /><Moment label="受付締切（利用日の）" value={draft.bookingDeadline} onChange={v => set({ bookingDeadline: v })} /></Row>
    <Moment label="この時点以降のキャンセルは施設の確認が必要（利用日の）" value={draft.cancelRequestFrom} onChange={v => set({ cancelRequestFrom: v })} />
    <Toggle label="満員のときはキャンセル待ちを受け付ける" checked={draft.waitlist} onChange={v => set({ waitlist: v })} />
    <Text label="保護者画面に表示する日数" name="list-days" type="number" min={3} max={31} value={draft.listDays} onChange={e => set({ listDays: Number(e.target.value) })} />
    <h3>定員と保育室</h3>
    <Text label="1日の定員（標準）" name="daily" type="number" min={1} max={60} value={draft.dailyCapacity} onChange={e => set({ dailyCapacity: Number(e.target.value) })} hint="日ごとの上限は「開園日・出力」タブで変更できます。" />
    {draft.rooms.map((r: any, i: number) => <div key={i} className="inline-fields"><Input aria-label={`保育室${i + 1}の名前`} value={r.name} onChange={e => set({ rooms: draft.rooms.map((x: any, j: number) => j === i ? { ...x, name: e.target.value } : x) })} /><Input type="number" min={1} max={20} aria-label={`保育室${i + 1}の定員`} value={r.capacity} onChange={e => set({ rooms: draft.rooms.map((x: any, j: number) => j === i ? { ...x, capacity: Number(e.target.value) } : x) })} /><span>名</span>{draft.rooms.length > 1 && <Button variant="ghost" onClick={() => set({ rooms: draft.rooms.filter((_: any, j: number) => j !== i) })}>削除</Button>}</div>)}
    <Button variant="outline" onClick={() => set({ rooms: [...draft.rooms, { name: `${draft.rooms.length + 1}号室`, capacity: 1 }] })}>保育室を追加</Button>
    <Text label="感染区分（カンマ区切り）" name="groups" value={Array.isArray(draft.groups) ? draft.groups.join(', ') : draft.groups} onChange={e => set({ groups: e.target.value.split(/[,、]/).map((x: string) => x.trim()) })} />
    <Toggle label="同じ保育室には同じ感染区分のお子さまだけを配置する" checked={draft.separateGroups} onChange={v => set({ separateGroups: v })} />
    <h3>利用料金（減免前）</h3>
    {draft.fees.map((f: any, i: number) => <div key={i} className="inline-fields"><Input type="number" min={1} max={24} aria-label={`料金${i + 1}の時間`} placeholder="それ以上" value={f.maxHours ?? ''} onChange={e => set({ fees: draft.fees.map((x: any, j: number) => j === i ? { ...x, maxHours: e.target.value === '' ? null : Number(e.target.value) } : x) })} /><span>時間以内（空欄＝それ以上）</span><Input type="number" min={0} max={100000} aria-label={`料金${i + 1}の金額`} value={f.amount} onChange={e => set({ fees: draft.fees.map((x: any, j: number) => j === i ? { ...x, amount: Number(e.target.value) } : x) })} /><span>円</span>{draft.fees.length > 1 && <Button variant="ghost" onClick={() => set({ fees: draft.fees.filter((_: any, j: number) => j !== i) })}>削除</Button>}</div>)}
    <Button variant="outline" onClick={() => set({ fees: [{ maxHours: 1, amount: 0 }, ...draft.fees] })}>料金の段階を追加</Button>
    <Text label="料金の補足（減免・支払方法など）" name="fee-note" required={false} value={draft.feeNote} onChange={e => set({ feeNote: e.target.value })} maxLength={300} />
    <h3>対象と書類</h3>
    <Row><Text label="対象年齢の下限（月齢）" name="age-min" type="number" min={0} max={72} value={draft.ageMinMonths} onChange={e => set({ ageMinMonths: Number(e.target.value) })} /><Text label="対象年齢の上限（歳）" name="age-max" type="number" min={1} max={18} value={draft.ageMaxYears} onChange={e => set({ ageMaxYears: Number(e.target.value) })} /></Row>
    <Toggle label="服薬がある場合は与薬依頼書を必須にする" checked={draft.requireMedicineDoc} onChange={v => set({ requireMedicineDoc: v })} />
    <Field label="利用条件（登録時に表示・同意）" hint="例：町内在住または町内の事業所に勤務する保護者のお子さま"><textarea className="settings-text" aria-label="利用条件（登録時に表示・同意）" value={draft.eligibilityNote} maxLength={500} onChange={e => set({ eligibilityNote: e.target.value })} /></Field>
    <Field label="ご利用案内に追加する内容" hint="持ち物、駐車場、当日の流れなど"><textarea className="settings-text" aria-label="ご利用案内に追加する内容" value={draft.guideNote} maxLength={2000} onChange={e => set({ guideNote: e.target.value })} /></Field>
    {preview && <div className="note"><strong>保護者への表示（プレビュー）</strong><p>{hoursText(preview)}／対象 {ageText(preview)}</p><p>受付：{momentText(preview.bookingOpens, 'から')}{momentText(preview.bookingDeadline, 'まで')}／料金：{feeText(preview)}</p></div>}
    {problem && <p role="alert" className="error">{problem}</p>}
    <div className="actions"><Button variant="outline" onClick={() => setDraft(clone(s.settings))}>変更を取り消す</Button><Button disabled={api.busy || !preview} onClick={() => api.act('update-settings', { version: s.settings.version, settings: draft }, 'ハウスルールを保存しました。新しい申込みから反映されます。')}>ハウスルールを保存</Button></div>
    {s.settingsHistory?.length > 0 && <details><summary>変更履歴（{s.settingsHistory.length}件）</summary>{s.settingsHistory.slice().reverse().map((h: any) => <p key={h.version} className="history-row"><time>{clockLabel(h.at)}</time>第{h.version}版から変更（{s.staff.find((m: any) => m.id === h.actor)?.name || '職員'}）</p>)}</details>}
  </Panel>;
}

// Remounts the form after a save so it starts from the stored version.
export function SettingsPanel({ api }: { api: Api }) {
  return <SettingsForm key={`${api.state.facilityId}:${api.state.settings.version}`} api={api} />;
}
