"use client";
// Reached from the password-reset email after /auth/confirm signed the user in.
import { useState } from 'react';
import { Frame, Panel, Text, Button, Feedback, values, useApi } from '../ui';
import { GuidedForm as Form } from '../interaction';

function Reset({ role }: { role: 'parent' | 'staff' }) {
  const api = useApi(role), [done, setDone] = useState(false);
  const home = role === 'staff' ? '/staff' : '/';
  const s = api.state;
  return <Frame staff={role === 'staff'}><Feedback api={api} />
    {!s ? <p role="status">確認しています…</p> : !s.authenticated ? <Panel title="リンクを確認できません"><p>再設定のリンクの有効期限が切れているか、既に使用されています。もう一度「パスワードを忘れた方」からお手続きください。</p><p><a href={home}>ログイン画面へ</a></p></Panel>
      : done ? <Panel title="パスワードを変更しました"><p>新しいパスワードでログインした状態です。</p><p><a className="line-open-browser" href={home}>{role === 'staff' ? '職員画面へ' : 'マイページへ'}</a></p></Panel>
      : <Panel title="新しいパスワードの設定"><p>ログイン中：{s.user?.email}</p><Form onSubmit={async e => { e.preventDefault(); const f = values(e.currentTarget); if (f.password !== f.password2) { api.setError('パスワードが一致しません。'); return; } if (await api.act('update-password', { password: f.password }, 'パスワードを変更しました。')) setDone(true); }}><fieldset disabled={api.busy}><Text label="新しいパスワード（10文字以上）" name="password" type="password" minLength={10} maxLength={72} autoComplete="new-password" /><Text label="新しいパスワードを再入力" name="password2" type="password" minLength={10} maxLength={72} autoComplete="new-password" /><Button type="submit" className="full">パスワードを変更</Button></fieldset></Form></Panel>}
  </Frame>;
}

export default function ResetPage() {
  const [role] = useState<'parent' | 'staff' | null>(() => typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('role') === 'staff' ? 'staff' : 'parent');
  return role ? <Reset role={role} /> : null;
}
