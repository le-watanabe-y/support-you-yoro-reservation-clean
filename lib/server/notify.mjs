// Email notifications through the Resend HTTP API. Optional: without RESEND_API_KEY and
// SUPPORTYOU_MAIL_FROM nothing is sent and the attempt is recorded as "skipped".
// Messages never contain names, symptoms or other medical details: only the facility,
// the date, the new state and a link back to the signed-in site.
import { ORGANIZATION } from '../facility-info.mjs';

export function mailConfigured(env = process.env) { return Boolean(env.RESEND_API_KEY && env.SUPPORTYOU_MAIL_FROM); }

export async function sendMail({ to, subject, text }, env = process.env, fetcher = fetch) {
  if (!mailConfigured(env)) return { status: 'skipped' };
  try {
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.SUPPORTYOU_MAIL_FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { status: 'failed', error: `HTTP ${response.status}` };
    return { status: 'sent' };
  } catch (error) {
    return { status: 'failed', error: String(error?.name || 'error') };
  }
}

const footer = (origin, facility) => `\n\n${facility?.name || ORGANIZATION.serviceName}\n${facility?.phone ? `電話：${facility.phone}\n` : ''}${origin}\n\nこのメールは送信専用です。ご返信いただいても確認できません。`;
const dateLabel = date => new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Tokyo' }).format(new Date(`${date}T12:00:00+09:00`));

export function parentMessage({ date, label, origin, facility, facilityId }) {
  return {
    subject: `【${facility?.name || ORGANIZATION.serviceName}】予約状況が更新されました`,
    text: `${date ? `${dateLabel(date)}のご予約（お申込み）` : 'ご登録内容'}について、状況が「${label}」に更新されました。\n\n詳細と施設からの連絡は、ログインしてご確認ください。\n${origin}/f/${facilityId}/line?view=history${footer(origin, facility)}`,
  };
}
export function facilityMessage({ date, label, origin, facility, facilityId }) {
  return {
    subject: `【${facility?.name || ORGANIZATION.serviceName}】${label}（${date}）`,
    text: `${dateLabel(date)}の予約について「${label}」がありました。\n職員画面で確認してください。\n${origin}/staff?f=${facilityId}${footer(origin, facility)}`,
  };
}
export function inviteMessage({ name, code, origin, expiresAt, where }) {
  return {
    subject: `【${ORGANIZATION.serviceName}】職員用アカウントへの招待（${where}）`,
    text: `${name} 様\n\n${ORGANIZATION.serviceName}（${where}）の職員画面への招待です。\n次のページで「招待を受けた方」を選び、このメールアドレス・招待コード・新しいパスワードを入力してください。すでに職員用アカウントをお持ちの場合は、ログイン後に「招待コードで施設を追加」から入力してください。\n\n${origin}/staff\n招待コード：${code}\n有効期限：${new Date(expiresAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}\n\n心当たりがない場合は、このメールを破棄してください。${footer(origin)}`,
  };
}
