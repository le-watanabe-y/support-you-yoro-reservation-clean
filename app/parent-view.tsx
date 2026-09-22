/* eslint-disable @typescript-eslint/no-explicit-any -- API projections are runtime-validated by the server boundary. */
"use client";
import { useEffect, useRef, useState } from 'react';
import { AccountForm, DocumentLinks, DocumentUpload, ParentOffer } from './controls';
import { TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PersistentParentTabs as Tabs } from './persistent-parent-tabs';
import { Frame, Panel, Pick, Check, Button, Text, LongText, Blank, Badge, Confirm, Feedback, dateLabel, clockLabel, values, templates, type Api } from './ui';
import { Details, GuidedForm as Form, Reveal, revealById } from './interaction';
import { loadParentUi, saveParentUi } from '@/lib/parent-ui-state.mjs';
import { FACILITY } from '@/lib/facility-info.mjs';

const CHILD_FIELDS: [string, string][] = [['name', 'お子さまの氏名'], ['kana', 'ふりがな'], ['birth', '生年月日'], ['guardian', '保護者氏名'], ['phone', '保護者の電話番号'], ['emergencyName', '緊急連絡先（氏名・続柄）'], ['emergencyPhone', '緊急連絡先の電話番号'], ['pickup', 'お迎えに来る可能性のある方'], ['allergy', 'アレルギー'], ['history', '既往歴・かかりつけ医']];

function ChildForm({ api, child, onDone }: { api: Api, child?: any, onDone: () => void }) {
  const [draft, setDraft] = useState<any>(null), [saved, setSaved] = useState<any>(child || {});
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  if (draft) return <Panel id="child-registration" autoReveal title="登録内容の確認"><dl className="facts">{CHILD_FIELDS.map(([k, label]) => <div key={k}><dt>{label}</dt><dd>{draft[k] || '（なし）'}</dd></div>)}</dl><p className="note">登録後すぐに予約の申込みができます。施設は初回の予約と一緒に登録内容を確認します。</p><div className="actions"><Button variant="outline" onClick={() => setDraft(null)}>入力に戻る</Button><Button disabled={api.busy} onClick={async () => { const r = await api.act(child ? 'edit-child' : 'register-child', { ...draft, id: child?.id, version: child?.version }, '利用者情報を登録しました。予約の申込みへ進めます。'); if (r) { setDraft(null); onDone(); } }}>この内容で登録</Button></div></Panel>;
  return <Panel id="child-registration" autoReveal title={child ? '利用者情報の変更' : 'お子さま・保護者の利用登録'}>
    <p className="note">病児保育の利用には事前の利用登録が必要です。入力内容は、お預かり中の安全管理と緊急時の連絡にのみ使用します。</p>
    <Form onSubmit={e => { e.preventDefault(); const f = values(e.currentTarget); setSaved(f); setDraft({ ...f, consent: f.consent === 'yes', emergencyConsent: f.emergencyConsent === 'yes' }); }}><fieldset disabled={api.busy}>
      <div className="form-grid">
        <Text label="お子さまの氏名" name="name" defaultValue={saved.name} maxLength={40} placeholder="例：山田 はな" autoComplete="off" />
        <Text label="ふりがな" name="kana" defaultValue={saved.kana} maxLength={40} placeholder="例：やまだ はな" autoComplete="off" />
        <Text label="生年月日" name="birth" type="date" defaultValue={saved.birth} max={today} />
        <Text label="保護者氏名" name="guardian" defaultValue={saved.guardian} maxLength={40} autoComplete="name" />
        <Text label="保護者の電話番号（日中つながる番号）" name="phone" type="tel" defaultValue={saved.phone} maxLength={20} autoComplete="tel" inputMode="tel" placeholder="例：090-1234-5678" />
        <Text label="緊急連絡先（氏名・続柄）" name="emergencyName" defaultValue={saved.emergencyName} maxLength={40} placeholder="例：山田 太郎（父）" />
        <Text label="緊急連絡先の電話番号" name="emergencyPhone" type="tel" defaultValue={saved.emergencyPhone} maxLength={20} inputMode="tel" />
      </div>
      <LongText label="お迎えに来る可能性のある方（保護者以外）" name="pickup" required={false} defaultValue={saved.pickup} maxLength={200} hint="氏名と続柄を入力してください。登録のない方にはお子さまをお引き渡しできません。" placeholder="例：山田 春子（祖母）" />
      <LongText label="アレルギー" name="allergy" defaultValue={saved.allergy} maxLength={200} placeholder="ない場合は「なし」" />
      <LongText label="既往歴・かかりつけ医" name="history" defaultValue={saved.history} maxLength={200} placeholder="例：熱性けいれん（2歳）／○○小児科" />
      <Check name="consent" defaultChecked={saved.consent === 'yes'}>対象年齢・利用条件を確認しました。食物アレルギーがある場合は除去食を持参することを確認しました。</Check>
      <Check name="emergencyConsent" defaultChecked={saved.emergencyConsent === 'yes'}>緊急時に上記へ連絡すること、お迎え時に本人確認を行うことを確認しました。</Check>
      <Button type="submit">登録内容を確認</Button>
    </fieldset></Form>
  </Panel>;
}

function ReservationForm({ date, api, onDone }: { date: string, api: Api, onDone: () => void }) {
  const rules = api.state.rules;
  const [draft, setDraft] = useState<any>(null), [saved, setSaved] = useState<any>({ childId: api.state.children[0]?.id || '', start: rules.arrivalTimes[0], end: rules.endTimes[rules.endTimes.length - 1], medication: 'なし' }), [formError, setFormError] = useState(''), [key] = useState(() => crypto.randomUUID());
  if (draft) return <Panel id="reservation-step" title="申込み内容の確認"><p className="step-label">手順 2 / 2 · 内容を確認して送信</p><dl className="facts"><div><dt>利用日</dt><dd>{dateLabel(date)}</dd></div><div><dt>お子さま</dt><dd>{api.state.children.find((c: any) => c.id === draft.childId)?.name}</dd></div><div><dt>利用時間</dt><dd>{draft.start}–{draft.end}</dd></div><div><dt>症状</dt><dd>{draft.symptom}</dd></div><div><dt>服薬</dt><dd>{draft.medication ? 'あり（与薬依頼書が必要）' : 'なし'}</dd></div>{draft.notes && <div><dt>連絡事項</dt><dd>{draft.notes}</dd></div>}</dl><p className="note">この操作は「申込み」です。医師連絡票などの必要書類を提出し、施設が確認するまで予約は確定しません。</p><div className="actions"><Button variant="outline" onClick={() => setDraft(null)}>入力に戻る</Button><Button disabled={api.busy} onClick={async () => { const r = await api.act('reserve', { ...draft, date, requestId: key }, '申込みを受け付けました。まだ確定ではありません。必要書類を提出してください。'); if (r) { onDone(); revealById('parent-booking-history'); } }}>申込みを送信</Button></div></Panel>;
  return <Panel id="reservation-step" title={`${dateLabel(date)}の申込み`} aside={<Button variant="ghost" onClick={onDone}>閉じる</Button>}><p className="step-label">手順 1 / 2 · 申込み内容を入力</p>
    <Form noValidate onSubmit={e => { e.preventDefault(); const f = values(e.currentTarget), labels: any = { childId: '利用するお子さま', start: '来園予定', end: 'お迎え予定', symptom: '症状', medication: '服薬の有無', agree: '確認欄' }, missing = Object.keys(labels).filter(k => !f[k]?.trim()); if (missing.length) { setFormError(`未入力の項目があります：${missing.map(k => labels[k]).join('、')}`); return; } if (f.start >= f.end) { setFormError('お迎え予定は、来園予定より後の時刻を選んでください。'); return; } setFormError(''); setSaved(f); setDraft({ ...f, medication: f.medication === 'あり', agree: true }); }}><fieldset disabled={api.busy}>
      {formError && <Reveal><p role="alert" className="error">{formError}</p></Reveal>}
      <Pick label="利用するお子さま" name="childId" defaultValue={saved.childId} items={api.state.children.map((c: any) => ({ value: c.id, label: c.name }))} />
      <div className="form-grid"><Pick name="start" defaultValue={saved.start} label="来園予定" items={rules.arrivalTimes} /><Pick name="end" defaultValue={saved.end} label="お迎え予定" items={rules.endTimes} /></div>
      <LongText label="症状（受診結果・体温など）" name="symptom" defaultValue={saved.symptom} maxLength={200} placeholder="例：発熱 38.5℃、咳。○○小児科で風邪と診断" />
      <Pick name="medication" defaultValue={saved.medication} label="お預かり中の服薬" items={['なし', 'あり']} />
      <LongText label="施設への連絡事項（任意）" name="notes" required={false} defaultValue={saved.notes} maxLength={500} placeholder="例：食欲がないので、ゼリーを持参します" />
      <Check name="agree" defaultChecked={saved.agree === 'yes'}>予約は施設の確認後に確定すること、事前の受診と医師連絡票が必要なことを確認しました。</Check>
      <Button type="submit">申込み内容を確認</Button>
    </fieldset></Form></Panel>;
}

function Booking({ b, api }: { b: any, api: Api }) {
  const c = api.state.children.find((c: any) => c.id === b.childId), active = !['cancelled', 'rejected', 'completed'].includes(b.status);
  return <article id={`parent-booking-${b.id}`} className="booking"><div className="booking-head"><div><p className="eyebrow">{dateLabel(b.date)} · {b.start}–{b.end}</p><h3>{c?.name}</h3></div><Badge status={b.status}>{b.label}</Badge></div>
    {b.reason && <p className="error">{b.reason}</p>}
    {b.status === 'pending' && !b.physician && <p className="note">医師連絡票が未提出です。受診後、下の「予約の詳細・書類・連絡」から提出してください。</p>}
    {b.status === 'cancel_requested' && <p className="note">取消しはまだ完了していません。施設の確認まで枠を保持します。当日の急ぎのご連絡は、施設へお電話ください{FACILITY.phone && `（${FACILITY.phone}）`}。</p>}
    <ParentOffer b={b} api={api} />
    {!b.archived && <Details><summary>予約の詳細・書類・連絡</summary>
      <DocumentLinks b={b} />
      <dl className="facts"><div><dt>症状</dt><dd>{b.symptom}</dd></div><div><dt>医師連絡票</dt><dd>{b.physician ? '提出済み' : '未提出'}</dd></div>{b.medication && <div><dt>与薬依頼書</dt><dd>{b.medicineDoc ? '提出済み' : '未提出'}</dd></div>}<div><dt>利用登録</dt><dd>{c?.status === 'approved' ? '施設確認済み' : '施設の確認が必要'}</dd></div>{b.fee !== null && <div><dt>利用料金（減免前）</dt><dd>{b.fee.toLocaleString()}円</dd></div>}</dl>
      {['pending', 'needs_documents', 'waitlisted', 'confirmed', 'offer_accepted'].includes(b.status) && <DocumentUpload b={b} api={api} />}
      <div className="history"><h4>この予約の履歴</h4>{b.events.map((x: any, i: number) => <p key={i}><time>{clockLabel(x.at)}</time>{x.label}</p>)}</div>
      <h4>施設との連絡</h4>{b.messages.length === 0 ? <p className="hint">この予約の連絡はまだありません。</p> : b.messages.map((m: any) => <div key={m.id} className="message"><strong>{m.from}</strong><span>{clockLabel(m.at)}</span><p>{m.text}</p></div>)}
      {active && <Form onSubmit={async e => { e.preventDefault(); const form = e.currentTarget, f = values(form); if (await api.act('message', { id: b.id, version: b.version, message: f.message }, '施設へ連絡しました。')) form.reset(); }}><fieldset disabled={api.busy}><LongText name="message" label="施設への連絡" maxLength={500} templates={templates.parentMessages} /><p className="hint">当日の急ぎのご連絡はお電話でお願いします。</p><Button variant="outline" type="submit">連絡を送る</Button></fieldset></Form>}
    </Details>}
    {active && !['checked_in', 'cancel_requested'].includes(b.status) && <div className="booking-bottom"><Confirm disabled={api.busy} label="キャンセル" description="利用日当日8:30以降の確定済み予約は「取消し申出」となり、施設の確認まで完了しません。それ以外はすぐにキャンセルされます。" onConfirm={() => api.act('cancel', { id: b.id, version: b.version }, 'キャンセルの処理状況を更新しました。表示をご確認ください。')} /></div>}
  </article>;
}

function Guide({ api }: { api: Api }) {
  const rules = api.state?.rules;
  return <Panel id="parent-guide" title="ご利用案内">
    <ol className="guide-list"><li><strong>利用登録</strong><p>保護者・お子さまの情報を登録します。施設が初回のご予約と一緒に内容を確認します。</p></li><li><strong>受診・申込み</strong><p>医療機関を受診し、医師連絡票を記入してもらいます。利用日の前日12時から当日の朝まで申込みできます。</p></li><li><strong>必要書類の提出</strong><p>医師連絡票（服薬がある場合は与薬依頼書も）を撮影して提出します。</p></li><li><strong>施設が確認して確定</strong><p>書類・症状・保育室の状況を確認して確定します。確定するとメールでお知らせします。</p></li><li><strong>当日</strong><p>来園時に職員がお子さまの様子を確認します。お迎え時は本人確認を行います。</p></li></ol>
    <h3>開所日・時間</h3><p>{FACILITY.hours}</p>{rules && <p>来園：{rules.arrivalTimes.join('・')} ／ お迎え：{rules.endTimes[0]}〜{rules.endTimes[rules.endTimes.length - 1]}</p>}
    <h3>定員</h3><p>1日{rules?.dailyCapacity ?? 6}名まで。満員の場合はキャンセル待ちとして受け付け、空きが出たときに意思確認のご連絡をします。</p>
    <h3>利用料金</h3><p>4時間以内 {(rules?.feeShort ?? 1000).toLocaleString()}円、4時間を超える場合 {(rules?.feeLong ?? 2000).toLocaleString()}円（減免制度があります。詳しくは施設へお問い合わせください）。お支払い方法は施設の案内に従ってください。</p>
    <h3>キャンセル</h3><p>画面からキャンセルできます。利用日当日8:30以降の確定済み予約は「取消し申出」となり、施設が確認して完了します。</p>
    <h3>お問い合わせ</h3><p>{FACILITY.name}{FACILITY.phone && <> 電話 <a href={`tel:${FACILITY.phone}`}>{FACILITY.phone}</a></>}{FACILITY.address && <><br />{FACILITY.address}</>}</p>
  </Panel>;
}

function AccountPanel({ api }: { api: Api }) {
  const [open, setOpen] = useState(false);
  return <Panel title="アカウント"><p>ログイン中：{api.state.user.email}</p>{!open ? <Button variant="outline" onClick={() => setOpen(true)}>パスワードを変更</Button> : <Form onSubmit={async e => { e.preventDefault(); const form = e.currentTarget, f = values(form); if (f.password !== f.password2) { setOpen(true); api.setError('パスワードが一致しません。'); return; } if (await api.act('update-password', { password: f.password }, 'パスワードを変更しました。')) setOpen(false); }}><fieldset disabled={api.busy}><Text label="新しいパスワード（10文字以上）" name="password" type="password" minLength={10} maxLength={72} autoComplete="new-password" /><Text label="新しいパスワードを再入力" name="password2" type="password" minLength={10} maxLength={72} autoComplete="new-password" /><div className="actions"><Button variant="outline" onClick={() => setOpen(false)}>やめる</Button><Button type="submit">変更する</Button></div></fieldset></Form>}</Panel>;
}

export default function ParentView({ api }: { api: Api }) {
  const s = api.state; const [date, setDate] = useState(''), [adding, setAdding] = useState(false), [edit, setEdit] = useState<any>(null); const restored = useRef('');
  const login = s?.authenticated && s.user?.householdId;
  useEffect(() => { if (!login || restored.current === login) return; restored.current = login; if (location.pathname === '/line' || location.pathname === '/line/') { setDate(''); return; } let saved = { date: '', scrollY: 0 }; try { saved = loadParentUi(login, localStorage); } catch { } setDate(s.availability?.some((a: any) => a.date === saved.date) ? saved.date : ''); requestAnimationFrame(() => requestAnimationFrame(() => scrollTo(0, saved.scrollY))); }, [login, s?.availability]);
  useEffect(() => { if (!login || restored.current !== login) return; const save = () => { const storage = () => window.localStorage; const old = loadParentUi(login, storage); saveParentUi(login, { ...old, date, scrollY }, storage); }; const visibility = () => { if (document.visibilityState === 'hidden') save(); }; addEventListener('pagehide', save); document.addEventListener('visibilitychange', visibility); return () => { save(); removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', visibility); }; }, [login, date]);
  const [notice] = useState(() => typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('notice') || '');
  const active = s?.bookings?.filter((b: any) => !['cancelled', 'rejected', 'completed'].includes(b.status)) || [];
  const past = s?.bookings?.filter((b: any) => ['cancelled', 'rejected', 'completed'].includes(b.status)) || [];
  return <Frame authenticated={s?.authenticated} onLogout={() => { setDate(''); setAdding(false); setEdit(null); api.act('logout', {}, 'ログアウトしました。'); }}><Feedback api={api} />
    {notice === 'confirmed' && <p className="notice">メールアドレスの確認が完了しました。</p>}
    {notice === 'link-invalid' && <p className="error">リンクの有効期限が切れているか、既に使用されています。ログインするか、もう一度お手続きください。</p>}
    {!s ? (!api.error && <p role="status">読み込んでいます…</p>) : !s.authenticated ? <div className="entry"><div className="entry-intro"><p className="eyebrow">{FACILITY.name}</p><h1>病児保育の<br />ご予約</h1><ol className="steps"><li className="current">アカウント作成・ログイン</li><li>お子さまの利用登録</li><li>受診・申込み・書類の提出</li><li>施設の確認後に予約確定</li></ol><p>{FACILITY.hours}</p></div><AccountForm api={api} /></div> : <>
      {!s.user.complete ? <><div className="page-title"><p className="eyebrow">登録ステップ 2 / 3</p><h1>利用登録をしましょう</h1><p>登録が完了すると、予約の申込みができます。</p></div><ChildForm api={api} onDone={() => { }} /><Guide api={api} /></> : <>
        <div className="page-title"><div><p className="eyebrow">マイページ · {s.user.email}</p><h1>ご利用の予約</h1></div><Button variant="outline" disabled={api.busy} onClick={api.refresh}>最新情報に更新</Button></div>
        <Tabs defaultValue="bookings"><TabsList className="main-tabs"><TabsTrigger value="bookings">予約・連絡</TabsTrigger><TabsTrigger value="children">利用者情報</TabsTrigger><TabsTrigger value="guide">ご利用案内</TabsTrigger></TabsList>
          <TabsContent value="bookings">
            <Panel id="reservation-days" title="予約できる日"><p className="hint">利用日の前日12時から、当日の来園予定時刻まで申込みできます。「予約可」は申込みを受け付けられる状態で、受入れを保証するものではありません。</p><div className="availability">{s.availability.map((a: any) => <button key={a.date} className={['予約可', 'キャンセル待ち'].includes(a.status) ? 'day available' : 'day'} disabled={!['予約可', 'キャンセル待ち'].includes(a.status) || api.busy} aria-pressed={date === a.date} onClick={() => { setDate(a.date); revealById('reservation-step'); }}><span>{dateLabel(a.date)}</span><strong>{a.status}</strong>{a.closure && <small>{a.closure}</small>}</button>)}</div></Panel>
            {date && <ReservationForm key={date} date={date} api={api} onDone={() => { setDate(''); revealById('reservation-days'); }} />}
            <Panel id="parent-booking-history" title="予約・申込み">{active.length ? active.slice().reverse().map((b: any) => <Booking key={b.id} b={b} api={api} />) : <Blank title="進行中の予約はありません" description="利用する日を選んで、申込みにお進みください。" />}</Panel>
            {past.length > 0 && <Panel title="これまでの利用・キャンセル">{past.slice().reverse().map((b: any) => <Booking key={b.id} b={b} api={api} />)}</Panel>}
          </TabsContent>
          <TabsContent value="children"><Panel id="parent-children" title="登録しているお子さま" aside={<Button variant="outline" onClick={() => { setAdding(true); setEdit(null); revealById('child-registration'); }}>お子さまを追加</Button>}>{s.children.map((c: any) => <article key={c.id} className="child"><div><h3>{c.name}（{c.kana}）</h3><p>{c.birth} 生 / 保護者：{c.guardian} {c.phone}</p><Badge>{c.status === 'approved' ? '施設確認済み' : c.status === 'returned' ? '修正が必要' : '施設の確認待ち'}</Badge>{c.reason && <p className="error">{c.reason}</p>}<p className="hint">緊急連絡先：{c.emergencyName} {c.emergencyPhone}<br />アレルギー：{c.allergy} / 既往歴：{c.history}{c.pickup && <><br />お迎え：{c.pickup}</>}</p></div><Button variant="outline" onClick={() => { setEdit(c); setAdding(false); revealById('child-registration'); }}>登録情報を変更</Button></article>)}</Panel>
            {(adding || edit) && <><p className="note">変更後は施設の再確認が必要です。そのお子さまの進行中の予約も確認待ちに戻ります。</p><ChildForm key={edit?.id || 'new'} child={edit} api={api} onDone={() => { setAdding(false); setEdit(null); revealById('parent-children'); }} /><Button variant="ghost" onClick={() => { setAdding(false); setEdit(null); revealById('parent-children'); }}>変更をやめる</Button></>}
            <AccountPanel api={api} />
          </TabsContent>
          <TabsContent value="guide"><Guide api={api} /></TabsContent>
        </Tabs></>}
    </>}
  </Frame>;
}
