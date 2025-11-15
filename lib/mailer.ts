// lib/mailer.ts  — 開発用：メール送信は完全スキップ（依存なし）

type Result =
  | { ok: true }
  | { ok: false; skipped?: true; reason?: string };

export async function sendReservationCompletedMail(_args: {
  to: string;
  subject: string;
  html: string;
}): Promise<Result> {
  // 本番でメールを有効化するまで常にスキップ
  return { ok: false, skipped: true, reason: "mail_disabled_in_dev" };
}
