"use client";
// Facility directory. With one active facility, go straight to it.
import { useEffect, useState } from 'react';
import { Frame, Panel, Blank } from './ui';

type Facility = { id: string, name: string, municipality: string };

export default function Directory() {
  const [list, setList] = useState<Facility[] | null>(null), [error, setError] = useState(''), [last, setLast] = useState('');
  useEffect(() => {
    try { setLast(localStorage.getItem('supportyou-last-facility') || ''); } catch { }
    fetch('/api/parent/facilities', { cache: 'no-store' }).then(r => r.json()).then(d => {
      const facilities: Facility[] = d.facilities || [];
      if (facilities.length === 1) { location.replace(`/f/${facilities[0].id}${location.search}`); return; }
      setList(facilities);
    }).catch(() => setError('施設の一覧を読み込めません。通信を確認して、再読み込みしてください。'));
  }, []);
  const notice = typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('notice');
  return <Frame>
    {notice === 'confirmed' && <p className="notice">メールアドレスの確認が完了しました。ご利用の施設を選んでください。</p>}
    {notice === 'link-invalid' && <p className="error">リンクの有効期限が切れているか、既に使用されています。</p>}
    <div className="page-title"><div><p className="eyebrow">病児保育のご予約</p><h1>ご利用の施設を選んでください</h1></div></div>
    {error && <p className="error">{error}</p>}
    {!list && !error && <p role="status">読み込んでいます…</p>}
    {list && (list.length ? <Panel title="施設の一覧"><div className="facility-list">{[...list].sort((a, b) => Number(b.id === last) - Number(a.id === last)).map(f => <a key={f.id} className="facility-card" href={`/f/${f.id}`}><strong>{f.name}</strong><span>{f.municipality}{f.id === last ? '（前回利用）' : ''}</span></a>)}</div><p className="hint">ひとつのアカウントで複数の施設を利用できます。利用登録は施設ごとに行います。</p></Panel> : <Blank title="受付中の施設はありません" description="施設からの案内をご確認ください。" />)}
  </Frame>;
}
