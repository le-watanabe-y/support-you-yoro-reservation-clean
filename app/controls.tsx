/* eslint-disable @typescript-eslint/no-explicit-any -- API projections are runtime-validated by the server boundary. */
"use client";
import { useEffect, useState } from 'react';
import { Panel, Button, Input, Pick, Check, Confirm, Field, Text, LongText, values, clockLabel, dateLabel, jstInput, type Api } from './ui';
import { Details, GuidedForm as Form, Reveal } from './interaction';
import { prepareUpload } from '@/lib/compress-image';

function PasswordField({ label, name = 'password', creating, show }: { label: string, name?: string, creating: boolean, show: boolean }) {
  return <Field label={label} hint={creating ? '10文字以上。他のサービスと同じものは使わないでください。' : undefined}><Input name={name} aria-label={label} type={show ? 'text' : 'password'} minLength={creating ? 10 : 1} maxLength={72} required autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete={creating ? 'new-password' : 'current-password'} onChange={e => e.target.setCustomValidity('')} /></Field>;
}

type Mode = 'login' | 'signup' | 'reset' | 'activate' | 'setup';
export function AccountForm({ api, staff = false }: { api: Api, staff?: boolean }) {
  const [mode, setMode] = useState<Mode>(() => staff && api.state?.setupAvailable ? 'setup' : 'login'), [show, setShow] = useState(false), [sent, setSent] = useState('');
  useEffect(() => { const hide = () => { if (document.visibilityState !== 'visible') setShow(false); }; document.addEventListener('visibilitychange', hide); return () => document.removeEventListener('visibilitychange', hide); }, []);
  const creating = ['signup', 'activate', 'setup'].includes(mode);
  const title = { login: staff ? '職員ログイン' : 'ログイン', signup: 'はじめての方：アカウント作成', reset: 'パスワードの再設定', activate: '招待を受けた職員の利用開始', setup: '本部管理者と最初の施設の登録' }[mode];
  if (sent) return <Panel title={mode === 'signup' ? '確認メールを送信しました' : 'メールを確認してください'} step={sent}><p>{sent}</p><p className="hint">メールが届かない場合は、迷惑メールフォルダや、ドメイン指定受信などの設定をご確認ください。</p><Button variant="outline" onClick={() => { setSent(''); setMode('login'); }}>ログインに戻る</Button></Panel>;
  return <Panel title={title} step={mode}>
    <p>{mode === 'login' ? (staff ? '職員用のメールアドレスでログインしてください。' : '登録済みの方はメールアドレスとパスワードでログインしてください。') : mode === 'signup' ? 'メールアドレスとパスワードを設定します。登録後、お子さまの情報を入力します。' : mode === 'reset' ? '登録したメールアドレスに、再設定用のリンクを送ります。' : mode === 'activate' ? '管理者から受け取った招待コードで、職員用アカウントを作成します。' : '本部（全施設を管理する）管理者と、最初の施設を登録します。配備時に設定した初期設定コードが必要です。施設はあとから追加できます。'}</p>
    <Form key={mode} onSubmit={async e => {
      e.preventDefault(); const form = e.currentTarget, f = values(form);
      if (creating && f.password !== f.password2) { const field = form.querySelector<HTMLInputElement>('[name=password2]'); field?.setCustomValidity('パスワードが一致しません。'); form.reportValidity(); return; }
      const action = mode === 'reset' ? 'reset-request' : mode;
      const r = await api.act(action, { email: f.email, password: f.password, consent: f.consent === 'yes', code: f.code, name: f.name, setupCode: f.setupCode, facilityId: f.facilityId, facilityName: f.facilityName, municipality: f.municipality }, mode === 'reset' ? '送信しました。' : mode === 'signup' ? 'アカウントを作成しました。' : 'ログインしました。');
      if (!r) return;
      if (mode === 'reset') setSent('入力されたメールアドレスが登録されている場合、パスワード再設定のリンクを送信しました。メールのリンクを開いて、新しいパスワードを設定してください。');
      else if (r.confirmationRequired) setSent('確認メールを送信しました。メールのリンクを開くと登録が完了し、ログインした状態になります。');
    }}>
      <fieldset disabled={api.busy}>
        {(mode === 'activate' || mode === 'setup') && <Text label="氏名" name="name" maxLength={40} autoComplete="name" placeholder="例：佐藤 花子" />}
        <Text label="メールアドレス" name="email" type="email" maxLength={254} autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email" />
        {mode === 'activate' && <Text label="招待コード" name="code" minLength={10} maxLength={64} autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} />}
        {mode === 'setup' && <><Text label="初期設定コード" name="setupCode" minLength={16} maxLength={200} autoComplete="off" autoCapitalize="none" spellCheck={false} /><Text label="最初の施設名" name="facilityName" maxLength={60} placeholder="例：病児保育室 Support you 養老" /><Text label="施設ID（URLに使う半角英数字）" name="facilityId" pattern="[a-z0-9][a-z0-9-]{1,30}" maxLength={31} placeholder="例：yoro" autoCapitalize="none" spellCheck={false} hint="保護者用のURLが /f/施設ID になります。後から変更できません。" /><Text label="市町村" name="municipality" required={false} maxLength={40} placeholder="例：養老町" /></>}
        {mode !== 'reset' && <PasswordField label={creating ? '新しいパスワード' : 'パスワード'} creating={creating} show={show} />}
        {creating && <PasswordField label="パスワードを再入力" name="password2" creating show={show} />}
        {mode !== 'reset' && <Button variant="outline" aria-pressed={show} onClick={() => setShow(v => !v)}>{show ? 'パスワードを隠す' : 'パスワードを表示'}</Button>}
        {mode === 'signup' && <Check name="consent"><a href="/terms" target="_blank">利用規約・個人情報の取扱い</a>を確認し、同意します。</Check>}
        <Button className="full" type="submit">{{ login: 'ログイン', signup: 'アカウントを作成', reset: '再設定のメールを送る', activate: '利用を開始する', setup: '管理者として登録' }[mode]}</Button>
      </fieldset>
    </Form>
    <div className="login-links">
      {mode !== 'login' && <Button variant="outline" onClick={() => setMode('login')}>ログインに戻る</Button>}
      {mode === 'login' && !staff && <Button variant="outline" onClick={() => setMode('signup')}>はじめての方：アカウントを作成</Button>}
      {mode === 'login' && staff && <Button variant="outline" onClick={() => setMode('activate')}>招待を受けた方：利用を開始</Button>}
      {mode === 'login' && staff && api.state?.setupAvailable && <Button variant="outline" onClick={() => setMode('setup')}>本部管理者と最初の施設を登録</Button>}
      {mode === 'login' && <Button variant="ghost" onClick={() => setMode('reset')}>パスワードを忘れた方</Button>}
    </div>
  </Panel>;
}

export function DocumentLinks({ b, staff = false }: { b: any, staff?: boolean }) {
  if (!b.documents?.length) return null;
  return <div className="document-list">{b.documents.map((d: any) => <p key={d.id}><a href={`/api/${staff ? 'staff' : 'parent'}/document?id=${encodeURIComponent(d.id)}`} target="_blank" rel="noreferrer">{d.kind === 'physician' ? '医師連絡票' : '与薬依頼書'}・第{d.revision}版</a> — {d.active ? '最新' : '旧版'} / {d.reviewedAt ? '施設確認済み' : '未確認'} / {clockLabel(d.submittedAt)}</p>)}</div>;
}

export function DocumentUpload({ b, api }: { b: any, api: Api }) {
  const [error, setError] = useState(''), requireMedicine = api.state.settings?.requireMedicineDoc !== false;
  return <Form onSubmit={async e => {
    e.preventDefault(); setError('');
    const form = e.currentTarget, data = new FormData();
    const physician = (form.elements.namedItem('physician') as HTMLInputElement).files?.[0];
    const medicine = (form.elements.namedItem('medicine') as HTMLInputElement | null)?.files?.[0];
    if (!physician) { setError('医師連絡票の写真またはPDFを選んでください。'); return; }
    if (b.medication && requireMedicine && !medicine) { setError('服薬ありの場合、与薬依頼書も選んでください。'); return; }
    data.set('id', b.id); data.set('version', String(b.version));
    data.set('physician', await prepareUpload(physician));
    if (medicine) data.set('medicine', await prepareUpload(medicine));
    const total = Array.from(data.values()).reduce((sum, file) => sum + (file instanceof File ? file.size : 0), 0);
    if (total > 4.3 * 1024 * 1024) { setError('ファイルが大きすぎます（合計4MBまで）。PDFの場合は、書類をカメラで撮影した写真で提出してください。'); return; }
    if (await api.upload('documents', data, '書類を提出しました。施設が確認します。')) form.reset();
  }}><fieldset disabled={api.busy}>
    <h4>必要書類の提出</h4>
    <p className="hint">受診した医療機関で記入してもらった書類を、スマートフォンで撮影するかPDFで提出してください（合計4MBまで。写真は自動で縮小します）。確定後に差し替えると、施設の再確認が必要になります。</p>
    <Field label="医師連絡票"><input className="file-input" type="file" name="physician" accept="image/*,application/pdf" required /></Field>
    {b.medication && <Field label={requireMedicine ? '与薬依頼書' : '与薬依頼書（任意）'}><input className="file-input" type="file" name="medicine" accept="image/*,application/pdf" required={requireMedicine} /></Field>}
    {error && <p role="alert" className="error">{error}</p>}
    <Button type="submit" variant="outline">書類を提出</Button>
  </fieldset></Form>;
}

export function ParentOffer({ b, api }: { b: any, api: Api }) {
  if (b.status !== 'offer_pending') return null;
  const expired = Date.parse(api.state.clock) >= Date.parse(b.offerExpiresAt);
  return <div className="note"><strong>空きが出ました。利用を希望しますか？</strong><p>返答期限：{clockLabel(b.offerExpiresAt)}。希望の返答後、施設が最終確認して確定します。</p>{expired ? <p>返答期限を過ぎました。施設からの連絡をお待ちください。</p> : <div className="actions"><Button disabled={api.busy} onClick={() => api.act('offer-reply', { id: b.id, version: b.version, accept: true }, '利用希望を送信しました。施設の確認をお待ちください。')}>利用を希望する</Button><Confirm disabled={api.busy} label="辞退" description="今回の繰上げを辞退し、この申込みを終了します。" onConfirm={() => api.act('offer-reply', { id: b.id, version: b.version, accept: false }, '繰上げを辞退しました。')} /></div>}</div>;
}

const staffLabel = (s: any, id: string) => { const m = s.staff.find((x: any) => x.id === id); return m ? m.name : '（停止中の職員）'; };

export function StaffExtras({ b, api }: { b: any, api: Api }) {
  const s = api.state, c = s.children.find((x: any) => x.id === b.childId);
  const defaultDue = jstInput(new Date(Math.min(Date.now() + 3600_000, Date.parse(`${b.date}T${b.end}:00+09:00`))));
  return <>
    {['waitlisted', 'pending'].includes(b.status) && b.needsOfferConsent && <Details><summary>繰上げの意思を確認する</summary><Form onSubmit={e => { e.preventDefault(); const f = values(e.currentTarget); api.act('offer', { ...f, id: b.id, version: b.version, registrationVersion: c?.version, registrationChecked: f.registrationChecked === 'yes', expiresAt: f.expiresAt + ':00+09:00', medical: f.medical === 'yes', infection: f.infection === 'yes', staffing: f.staffing === 'yes' }, '枠を仮確保し、保護者へ繰上げの意思確認を送りました。'); }}><fieldset disabled={api.busy}>{c?.status !== 'approved' && <Check name="registrationChecked">利用者情報・緊急連絡先・対象条件を確認した</Check>}<Check name="medical">医師連絡票と利用条件を確認した</Check><Check name="infection">感染区分と同室の可否を確認した</Check><Check name="staffing">保育・看護の職員体制を確認した</Check><div className="form-grid"><Pick name="room" label="保育室" items={s.settings.rooms.map((r: any) => r.name)} /><Pick name="group" label="感染区分" items={s.settings.groups} /></div><Field label="返答期限（日本時間）"><Input name="expiresAt" aria-label="返答期限" type="datetime-local" required defaultValue={defaultDue} /></Field><Button type="submit">繰上げの意思確認を送る</Button></fieldset></Form></Details>}
    {b.status === 'offer_pending' && <p className="note">繰上げ返答期限：{clockLabel(b.offerExpiresAt)}。返答と職員の再確認まで枠を保持します。{Date.parse(s.clock) >= Date.parse(b.offerExpiresAt) && <Button disabled={api.busy} onClick={() => api.act('expire-offer', { id: b.id, version: b.version }, '返答期限切れとして、キャンセル待ちへ戻しました。')}>期限切れを処理</Button>}</p>}
    {!['cancelled', 'rejected', 'completed'].includes(b.status) && <Details><summary>担当者と対応期限{b.assignee ? `（${staffLabel(s, b.assignee)}）` : ''}</summary><Form onSubmit={e => { e.preventDefault(); const f = values(e.currentTarget); api.act('assign', { id: b.id, version: b.version, assignee: f.assignee, dueAt: f.dueAt + ':00+09:00' }, '担当者と期限を保存しました。'); }}><fieldset disabled={api.busy}><Pick label="担当者" name="assignee" defaultValue={b.assignee || undefined} items={s.staff.filter((x: any) => x.active).map((x: any) => ({ value: x.id, label: `${x.name}${x.permission === 'admin' ? '（管理者）' : ''}` }))} /><Field label="対応期限（日本時間）"><Input type="datetime-local" aria-label="対応期限" name="dueAt" required defaultValue={defaultDue} /></Field><Button variant="outline" type="submit">担当・期限を保存</Button></fieldset></Form></Details>}
  </>;
}

export function Tasks({ api, onOpen }: { api: Api, onOpen?: (id: string) => void }) {
  const s = api.state;
  return <Panel title="次に対応すること">{!s.tasks.length ? <p>対応が必要な予約はありません。</p> : s.tasks.map((t: any) => { const b = s.bookings.find((x: any) => x.id === t.bookingId), c = s.children.find((x: any) => x.id === b?.childId); return <div className={t.overdue ? 'child overdue' : 'child'} key={t.id}><div><strong>{c?.name} — {t.action}</strong><p>{b && `${dateLabel(b.date)} ${b.start}–${b.end} / `}{t.assignee ? `担当：${staffLabel(s, t.assignee)}` : '担当未設定'} / 期限 {clockLabel(t.dueAt)}{t.overdue ? '・期限超過' : ''}</p></div>{t.bookingId && <a href={`#booking-${t.bookingId}`} onClick={e => { if (onOpen) { e.preventDefault(); onOpen(t.bookingId); } }}>予約を確認</a>}{t.resolved === false && b?.status === 'completed' && <Button disabled={api.busy} onClick={() => api.act('resolve-incident', { id: b.id, version: b.version, incidentId: t.id, checked: true }, '個別対応を完了しました。')}>退室後の個別対応を完了</Button>}</div>; })}</Panel>;
}

export function FacilityCalendar({ api }: { api: Api }) {
  const s = api.state, [date, setDate] = useState(s.days[0]?.date || '');
  const admin = s.permission === 'admin', day = s.days.find((d: any) => d.date === date);
  return <Panel title="開園日と受入上限（14日間）">
    <div className="table-scroll"><table className="simple-table"><thead><tr><th>日付</th><th>状態</th><th>確保中 / 上限</th></tr></thead><tbody>{s.days.map((d: any) => <tr key={d.date} className={d.date === date ? 'selected' : ''}><td>{dateLabel(d.date)}</td><td>{d.closure ? `休園（${d.closure}）` : '開園'}</td><td>{d.closure ? '—' : `${d.held} / ${d.capacity}名`}</td></tr>)}</tbody></table></div>
    {!admin ? <p className="hint">休園・上限の変更は管理者が行います。</p> : <>
      <Field label="変更する日"><Input type="date" aria-label="変更する日" value={date} min={s.days[0]?.date} onChange={e => setDate(e.target.value)} /></Field>
      {date && <><p>{dateLabel(date)}：{s.closed.includes(date) ? '休園（施設設定）' : day?.closure ? `休園（${day.closure}）` : '開園'} / 上限 {s.dayCapacity[date] ?? s.settings.dailyCapacity}名</p>
        {s.closed.includes(date) ? <Confirm label="休園設定を解除" description="受付可能な日に戻します。取り消された予約は自動では戻りません。" onConfirm={() => api.act('reopen-day', { date }, '休園設定を解除しました。')} />
          : !day?.closure && <Form onSubmit={e => { e.preventDefault(); const f = values(e.currentTarget); api.act('close-day', { date, confirm: true, reason: f.reason }, '休園に設定しました。対象の保護者へ連絡しました。'); }}><fieldset disabled={api.busy}><Text label="休園の理由（保護者に表示）" name="reason" maxLength={200} placeholder="例：職員の急病のため" /><Check name="confirmClose">入室前の確定予約は取消し確認待ち、未確定の申込みは受入不可になることを確認した</Check><Button variant="outline" type="submit">この日を休園にする</Button></fieldset></Form>}
        <Form onSubmit={e => { e.preventDefault(); const f = values(e.currentTarget); api.act('capacity', { date, capacity: Number(f.capacity) }, '受入上限を保存しました。'); }}><fieldset disabled={api.busy}><Pick name="capacity" label="この日の受入上限" items={Array.from({ length: s.settings.rooms.reduce((n: number, r: any) => n + r.capacity, 0) + 1 }, (_, i) => String(i))} /><Button variant="outline" type="submit">上限を保存</Button></fieldset></Form></>}
    </>}
  </Panel>;
}

export function StaffAdmin({ api, facility }: { api: Api, facility: string }) {
  const s = api.state, [invite, setInvite] = useState<any>(null), [maintenance, setMaintenance] = useState<any>(null);
  if (s.permission !== 'admin') return <p className="hint">職員管理・データ出力の一部は管理者のみ操作できます。</p>;
  return <>
    <Panel title="職員">
      {s.staff.map((m: any) => <div key={m.id} className="child"><span>{m.name}（{m.email || 'メール未登録'}） / {m.permission === 'admin' ? '管理者' : '職員'} / {m.active ? '有効' : '停止中'}</span><div className="actions">{m.active && <Confirm disabled={api.busy} label={m.permission === 'admin' ? '一般職員に変更' : '管理者に変更'} description="次の操作から反映します。最後の管理者は変更できません。" onConfirm={() => api.act('staff-membership', { memberId: m.id, version: m.version, permission: m.permission === 'admin' ? 'operator' : 'admin', active: true }, '権限を変更しました。')} />}<Confirm disabled={api.busy} label={m.active ? '利用を停止' : '利用を再開'} description="停止した職員は、すぐに職員画面を利用できなくなります。最後の管理者は停止できません。" onConfirm={() => api.act('staff-membership', { memberId: m.id, version: m.version, permission: m.permission, active: !m.active }, m.active ? '利用を停止しました。' : '利用を再開しました。')} /></div></div>)}
      <h3>職員を招待</h3>
      <Form onSubmit={async e => { e.preventDefault(); const form = e.currentTarget, f = values(form); const r = await api.act('staff-invite', { name: f.name, email: f.email, permission: f.permission, sendEmail: f.sendEmail === 'yes' }, '招待コードを発行しました。'); if (r) { setInvite(r); form.reset(); } }}><fieldset disabled={api.busy}><div className="form-grid"><Text label="氏名" name="name" maxLength={40} /><Text label="メールアドレス" name="email" type="email" maxLength={254} autoCapitalize="none" /></div><Pick name="permission" label="権限" items={[{ value: 'operator', label: '職員（予約の確認・受付）' }, { value: 'admin', label: '管理者（職員管理・休園設定も可能）' }]} />{s.mailConfigured && <label className="check"><input type="checkbox" name="sendEmail" value="yes" defaultChecked /> <span>招待コードをメールでも送る</span></label>}<Button variant="outline" type="submit">招待コードを発行</Button></fieldset></Form>
      {invite && <Reveal><div className="notice"><strong>招待コード（この画面でのみ表示）</strong><code className="recovery">{invite.code}</code><p>有効期限：{clockLabel(invite.expiresAt)}。{invite.mailed ? '招待メールを送信しました。' : '職員へ直接お伝えください。'}職員画面の「招待を受けた方」から、同じメールアドレスで登録します。</p><Button variant="outline" onClick={() => setInvite(null)}>閉じる</Button></div></Reveal>}
      {s.invitations?.map((x: any) => <div key={x.id} className="child"><span>{x.name}（{x.email}） / {x.permission === 'admin' ? '管理者' : '職員'} / 期限 {clockLabel(x.expires_at)}</span><Confirm label="招待を取消し" description="この招待コードは使えなくなります。" onConfirm={() => api.act('staff-invite-revoke', { id: x.id }, '招待を取り消しました。')} /></div>)}
    </Panel>
    <Panel title="メール通知の送信状況">
      {!s.mailConfigured && <p className="note">メール送信は未設定です（RESEND_API_KEY・SUPPORTYOU_MAIL_FROM）。保護者は画面を開いて状況を確認します。</p>}
      {s.notifications?.length ? <div className="table-scroll"><table className="simple-table"><thead><tr><th>日時</th><th>内容</th><th>宛先</th><th>結果</th></tr></thead><tbody>{s.notifications.map((n: any) => <tr key={n.id}><td>{clockLabel(n.created_at)}</td><td>{n.kind}</td><td>{({ parent: '保護者', facility: '施設', staff: '職員' } as any)[n.recipient_role] || n.recipient_role}</td><td>{({ sent: '送信済み', failed: `失敗${n.error ? `（${n.error}）` : ''}`, skipped: '未設定のため未送信' } as any)[n.status]}</td></tr>)}</tbody></table></div> : <p className="hint">まだ通知はありません。</p>}
    </Panel>
    <Panel title="データの保全">
      <p>全データ（利用者・予約・操作履歴）をJSON形式で保存できます。月に1回程度、安全な場所へ保管してください。</p>
      <p><a className="line-open-browser" href={`/api/staff/backup?f=${facility}`} download>この施設の全データを書き出す（JSON）</a></p>
      <h3>未参照の書類ファイル</h3><p className="hint">保存途中の失敗で残ったファイルを点検します。24時間の隔離後、再確認してから削除します。</p>
      <div className="actions"><Button variant="outline" disabled={api.busy} onClick={async () => setMaintenance(await api.act('orphan-scan', {}, '点検しました。'))}>点検する</Button><Button variant="outline" disabled={api.busy} onClick={async () => setMaintenance(await api.act('orphan-cleanup', {}, '整理しました。'))}>隔離期限を過ぎたものを削除</Button></div>
      {maintenance && <p className="notice">未参照 {maintenance.orphanCount ?? 0}件・隔離中 {maintenance.quarantined ?? 0}件・削除 {maintenance.deleted ?? 0}件</p>}
    </Panel>
  </>;
}

export function ExportPanel({ facility }: { facility: string }) {
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const first = today.slice(0, 8) + '01';
  const [from, setFrom] = useState(first), [to, setTo] = useState(today);
  return <Panel title="予約一覧の出力（CSV）"><p className="hint">利用実績の集計・市町村への報告用です。Excelで開けます。個人情報を含むため、取扱いに注意してください。</p><div className="form-grid"><Field label="開始日"><Input type="date" aria-label="開始日" value={from} onChange={e => setFrom(e.target.value)} /></Field><Field label="終了日"><Input type="date" aria-label="終了日" value={to} onChange={e => setTo(e.target.value)} /></Field></div><a className="line-open-browser" href={`/api/staff/export?f=${facility}&from=${from}&to=${to}`} download>CSVをダウンロード</a></Panel>;
}

export { LongText };
