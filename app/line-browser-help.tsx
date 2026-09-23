"use client";
import { useEffect, useState } from 'react';
import { externalLinePath } from '@/lib/line-entry.mjs';

export function LineBrowserHelp({ staff = false }: { staff?: boolean }) {
  const [href, setHref] = useState('');
  useEffect(() => {
    if (/\bLine\//i.test(navigator.userAgent)) setHref(externalLinePath(location.pathname, location.search));
  }, [staff]);
  if (!href) return null;
  return <details className="line-browser-help">
    <summary>LINEで画面が開かない・ログインできないとき</summary>
    <p>Safari・Chromeで開き直し、同じIDでログインしてください。予約済みの内容は引き継がれます。送信途中の場合は、履歴で結果を確認してから再操作してください。</p>
    <a className="line-open-browser" href={href} target="_top">Safari・Chromeで開く</a>
    <p className="hint">切り替わらない場合は、LINE画面のメニューから「ブラウザで開く」を選んでください。</p>
  </details>;
}
