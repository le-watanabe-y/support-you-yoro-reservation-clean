"use client";
import { useEffect, useState } from 'react';
import { Button, Panel } from './ui';
import { lineEntryPath, buildLineMenu } from '@/lib/line-entry.mjs';

export function LineSetup() {
  const [origin, setOrigin] = useState('');
  const [result, setResult] = useState('');
  useEffect(() => { setOrigin(location.origin); }, []);
  const links = [
    { label: '保護者：予約申込み', path: lineEntryPath('reserve') },
    { label: '保護者：予約確認', path: lineEntryPath('history') },
    { label: '保護者：利用案内', path: lineEntryPath('guide') },
    { label: '職員専用', path: lineEntryPath('reserve', true) },
  ];
  const copy = async (label: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setResult(`${label}をコピーしました。`); }
    catch { setResult('コピーできませんでした。表示された内容を長押ししてコピーしてください。'); }
  };
  return <Panel title="LINE公式アカウントからの入口">
    <p>LINE公式アカウントのリッチメニューに、下の保護者用リンクを設定します。職員用リンクは保護者向けメニューに入れないでください。</p>
    <div className="line-setup-links">{links.map(({ label, path }) => <div key={path}>
      <strong>{label}</strong><a href={path}>{origin + path}</a>
      <Button variant="outline" onClick={() => copy(`${label}のリンク`, origin + path)}>リンクをコピー</Button>
    </div>)}</div>
    <p role="status">{result}</p>
    <details><summary>LINEリッチメニューの設定手順</summary>
      <ol className="guide-list"><li>LINE Official Account Manager で、施設の公式アカウントを開きます。</li><li>「リッチメニュー」を作成し、テンプレートは横に3つ並ぶ大きいサイズを選びます。</li><li>下のメニュー画像を保存して登録します。</li><li>左から「予約申込み」「予約確認」「利用案内」のリンクを、それぞれのアクション（リンク）に設定します。</li><li>職員のスマートフォンでLINEから開き、ログイン・申込み・履歴表示を確認してから公開します。</li></ol>
      <p><a className="line-open-browser" href="/line-menu.png" download>メニュー画像を保存</a></p>
      {origin.startsWith('https://') && <Button variant="outline" onClick={() => copy('Messaging API用のメニュー設定（JSON）', JSON.stringify(buildLineMenu(origin), null, 2))}>Messaging API用の設定（JSON）をコピー</Button>}
      <p className="hint">LINEアプリ内のブラウザでもログインできます。ログイン状態が保持されない場合は、画面下の案内からSafari・Chromeで開き直してください。</p>
    </details>
  </Panel>;
}
