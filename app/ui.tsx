/* eslint-disable @typescript-eslint/no-explicit-any -- API projections are runtime-validated by the server boundary. */
"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode, type ComponentProps } from 'react';
import { Button as BaseButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { useStepFocus } from './interaction';
import { LineBrowserHelp } from './line-browser-help';
import { ORGANIZATION } from '@/lib/facility-info.mjs';
export { Input, Textarea };
export function Button({ type = 'button', ...props }: ComponentProps<typeof BaseButton>) { return <BaseButton type={type} {...props} />; }
export const templates = {
  reasons: ['医師連絡票の記載内容を確認させてください', '医師連絡票の画像が読み取れません。撮り直してください', '与薬依頼書を提出してください', '利用者情報を確認させてください', '受入体制の都合によりお預かりできません', '症状によりお受けできません。医療機関へご相談ください'],
  parentMessages: ['書類を提出しました', '持ち物を確認したいです', 'お迎えの時間が変わります', '症状が変わりました', '確認しました'],
  staffMessages: ['書類を確認しました', '当日の持ち物をご確認ください', 'お迎え予定の確認をお願いします', '施設へお電話をお願いします', '確認しました'],
};
export const dateLabel = (d: string) => new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Tokyo' }).format(new Date(d.length === 10 ? d + 'T12:00:00+09:00' : d));
export const clockLabel = (d: string) => new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }).format(new Date(d));
export const jstInput = (d: Date) => new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 16);
export const values = (form: HTMLFormElement) => Object.fromEntries(Array.from(new FormData(form).entries()).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
export function Field({ label, children, hint }: { label: string, children: ReactNode, hint?: string }) { return <div className="field"><div className="field-label">{label}</div>{children}{hint && <p className="hint">{hint}</p>}</div>; }
export function Pick({ label, name, items, value, defaultValue, onChange, required = true }: { label: string, name: string, items: string[] | { value: string, label: string }[], value?: string, defaultValue?: string, onChange?: (x: string) => void, required?: boolean }) { return <Field label={label}><Select name={name} required={required} value={value} defaultValue={defaultValue} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue placeholder="選択してください" /></SelectTrigger><SelectContent>{items.map(item => { const v = typeof item === 'string' ? item : item.value; return <SelectItem key={v} value={v}>{typeof item === 'string' ? item : item.label}</SelectItem>; })}</SelectContent></Select></Field>; }
export function Text({ label, name, hint, required = true, ...props }: { label: string, name: string, hint?: string } & ComponentProps<typeof Input>) { return <Field label={label} hint={hint}><Input name={name} aria-label={label} required={required} {...props} /></Field>; }
export function LongText({ label, name, hint, required = true, templates: options, ...props }: { label: string, name: string, hint?: string, templates?: string[] } & ComponentProps<typeof Textarea>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return <Field label={label} hint={hint}>{options && <div className="templates">{options.map(t => <button type="button" key={t} className="template" onClick={() => { if (ref.current) { ref.current.value = t; ref.current.focus(); } }}>{t}</button>)}</div>}<Textarea ref={ref} name={name} aria-label={label} required={required} rows={3} {...props} /></Field>;
}
export function Check({ name, children, defaultChecked = false }: { name: string, children: ReactNode, defaultChecked?: boolean }) { return <label className="check"><Checkbox name={name} value="yes" required defaultChecked={defaultChecked} /><span>{children}</span></label>; }
export function Panel({ title, children, aside, id, autoReveal = false, step }: { title: string, children: ReactNode, aside?: ReactNode, id?: string, autoReveal?: boolean, step?: unknown }) { const ref = useStepFocus<HTMLElement>(step ?? title, autoReveal); return <section id={id} ref={ref} className="panel"><div className="panel-head"><h2 tabIndex={-1}>{title}</h2>{aside}</div>{children}</section>; }
export function Blank({ title, description }: { title: string, description: string }) { return <Empty className="empty"><EmptyHeader><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader></Empty>; }
export function Badge({ children, status = '' }: { children: ReactNode, status?: string }) { return <span className={'badge ' + status}>{children}</span>; }
export function Confirm({ label, description, onConfirm, disabled = false }: { label: string, description: string, onConfirm: () => void, disabled?: boolean }) { return <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" disabled={disabled}>{label}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogTitle>{label}しますか？</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>戻る</AlertDialogCancel><AlertDialogAction onClick={onConfirm}>{label}する</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>; }
export function Frame({ staff = false, authenticated, onLogout, facility, children }: { staff?: boolean, authenticated?: boolean, onLogout?: () => void, facility?: { id?: string, name?: string, phone?: string, address?: string } | null, children: ReactNode }) {
  const home = staff ? '/staff' : facility?.id ? `/f/${facility.id}` : '/';
  return <><header className="site-header"><div><a href={home} className="brand">Support <span>you</span></a><p>{facility?.name || ORGANIZATION.serviceName} <span className="divider">/</span> {staff ? '職員用' : '保護者用予約'}</p></div>{authenticated && <Button variant="outline" onClick={onLogout}>ログアウト</Button>}</header><main className={staff ? 'main staff-main' : 'main'}>{children}<LineBrowserHelp staff={staff} /></main><footer>{facility?.name ? <>{facility.name}{facility.phone && <> ・ 電話 <a href={`tel:${facility.phone}`}>{facility.phone}</a></>}{facility.address && <><br />{facility.address}</>}<br /></> : null}{!staff && <><a href="/">施設の一覧</a> ・ </>}<a href="/terms">利用規約・個人情報の取扱い</a><br />運営：{ORGANIZATION.operator}</footer></>;
}

type Api = ReturnType<typeof useApi>;
export function useApi(role: 'parent' | 'staff', facilityId = '') {
  const [state, setState] = useState<any>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [checking, setChecking] = useState(false);
  const sending = useRef(false), generation = useRef(0), lastChecked = useRef(0), refreshing = useRef<Promise<void> | null>(null);
  const request = useCallback(async (path: string, options: RequestInit = {}) => {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), path === 'state' ? 20000 : 60000);
    try { const response = await fetch(`/api/${role}/${path}${facilityId ? `?f=${encodeURIComponent(facilityId)}` : ''}`, { ...options, credentials: 'same-origin', cache: 'no-store', signal: controller.signal }); let data; try { data = await response.json(); } catch { throw new Error('応答を確認できません。最新情報を読み直して、保存結果を確認してください。'); } return { response, data }; }
    catch (e: any) { if (e.name === 'AbortError') throw new Error(path === 'state' ? '読込みに時間がかかっています。通信を確認して、もう一度読み直してください。' : '通信の確認に時間がかかっています。保存結果は未確認です。最新情報を読み直してから再操作してください。'); if (e instanceof TypeError) throw new Error('通信できません。電波の良い場所で、最新情報を読み直してから再操作してください。'); throw e; }
    finally { clearTimeout(timeout); }
  }, [role, facilityId]);
  const failure = (d: any, fallback: string) => (d.error || fallback) + (d.requestId ? `（確認番号：${d.requestId.slice(0, 8)}）` : '');
  const refresh = useCallback(() => {
    if (refreshing.current) return refreshing.current;
    const version = generation.current;
    const job = (async () => { const { response: r, data: d } = await request('state'); if (version !== generation.current) return; if (!r.ok) { if (r.status === 401) setState({ authenticated: false }); throw new Error(failure(d, '画面を読み込めません。')); } lastChecked.current = Date.now(); setState(d); })();
    refreshing.current = job; void job.finally(() => { if (refreshing.current === job) refreshing.current = null; }).catch(() => {}); return job;
  }, [request]);
  // Switching facility discards any in-flight answer for the previous one.
  const shown = useRef(facilityId);
  if (shown.current !== facilityId) { shown.current = facilityId; generation.current++; refreshing.current = null; }
  useEffect(() => { const timer = setTimeout(() => { void refresh().catch(e => setError(e.message)); }, 0); const resume = () => { if (document.visibilityState === 'visible' && !sending.current && Date.now() - lastChecked.current >= 30000) void refresh().catch(e => setError(e.message)); }; window.addEventListener('pageshow', resume); document.addEventListener('visibilitychange', resume); return () => { clearTimeout(timer); window.removeEventListener('pageshow', resume); document.removeEventListener('visibilitychange', resume); }; }, [refresh]);
  const send = async (path: string, init: RequestInit, success: string) => {
    if (sending.current) return null; sending.current = true; generation.current++; setBusy(true); setError(''); setNotice('');
    try {
      if (refreshing.current) await refreshing.current.catch(() => {});
      const { response: r, data: d } = await request(path, { method: 'POST', ...init, headers: { 'x-supportyou-request': '1', ...(init.headers || {}) } });
      if (!r.ok) { if (d.code === 'SESSION_INVALID') setState({ authenticated: false }); throw new Error(failure(d, '保存できません。')); }
      setNotice(success);
      if (d.state?.authenticated) { setState(d.state); lastChecked.current = Date.now(); }
      else if (path === 'logout') { setState({ authenticated: false }); lastChecked.current = Date.now(); }
      else if (!['reset-request', 'signup'].includes(path) || d.state) try { await refresh(); } catch { setError('保存は完了しましたが、画面を更新できません。最新情報を読み直してください。'); }
      return d;
    } catch (e: any) { setError(e.message || '通信できません。保存結果を確認してから再操作してください。'); return null; }
    finally { sending.current = false; setBusy(false); }
  };
  const act = (path: string, body: any = {}, success = '保存しました。') => send(path, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, success);
  const upload = (path: string, form: FormData, success = '送信しました。') => send(path, { body: form }, success);
  return { state, error, notice, busy: busy || checking, act, upload, setError, refresh: async () => { if (sending.current) return; setChecking(true); setError(''); setNotice(''); try { await refresh(); setNotice('最新の情報を読み込みました。'); } catch (e: any) { setError(e.message); } finally { setChecking(false); } } };
}
export type { Api };
export function Feedback({ api }: { api: Api }) {
  const ref = useRef<HTMLDivElement>(null), [dismissed, setDismissed] = useState('');
  const signature = JSON.stringify([api.error, api.notice, api.busy]);
  const visible = Boolean(api.busy || api.error || api.notice) && (api.busy || dismissed !== signature);
  useEffect(() => {
    const update = () => document.documentElement.style.setProperty('--workflow-feedback-height', visible ? `${(ref.current?.getBoundingClientRect().height || 0) + 24}px` : '0px');
    update(); const observer = new ResizeObserver(update); if (ref.current) observer.observe(ref.current);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--workflow-feedback-height'); };
  }, [visible, signature]);
  return visible ? <div ref={ref} className={`workflow-feedback ${api.error ? 'is-error' : api.busy ? 'is-busy' : 'is-success'}`}>
    <div role={api.error ? 'alert' : 'status'} aria-live={api.error ? 'assertive' : 'polite'} aria-atomic="true"><strong>{api.error ? '操作結果を確認してください' : api.busy ? '処理中です' : '操作結果'}</strong><p>{api.error || (api.busy ? '処理を確認しています。画面を閉じずにお待ちください。' : api.notice)}</p>{api.error && api.notice && <p>{api.notice}</p>}</div>
    {!api.busy && <div className="feedback-actions">{api.error && <Button variant="outline" onClick={api.refresh}>最新情報を読み直す</Button>}{api.state && <Button variant="outline" aria-label="操作結果を閉じる" onClick={() => setDismissed(signature)}>閉じる</Button>}</div>}
  </div> : null;
}
