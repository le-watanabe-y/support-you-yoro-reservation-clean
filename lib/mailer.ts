// lib/mailer.ts
type Row = {
  id?: string;
  guardian_name: string;
  email: string;
  child_name?: string | null;
  child_birthdate?: string | null;
  preferred_date: string;  // YYYY-MM-DD
  dropoff_time: string;    // HH:MM
  status: "approved" | "pending";
};

function htmlEscape(s: string | null | undefined) {
  if (!s) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]!));
}

export async function sendReservationEmails(row: Row) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "onboarding@resend.dev"; // Resendの検証用From
  const admin = process.env.MAIL_TO_ADMIN || "";

  // キー無しなら送信スキップ（予約は成功させる）
  if (!key) return { ok: false, skipped: true, reason: "no_key" };

  const { Resend } = await import("resend");
  const resend = new Resend(key);

  const subjectUser =
    row.status === "approved"
      ? "【受付完了／承認済】病児保育 予約を受け付けました"
      : "【受付完了／保留】病児保育 予約を受け付けました";

  const bodyHtml = `
    <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont">
      <p>${htmlEscape(row.guardian_name)} 様</p>
      <p>病児保育の予約を受け付けました。</p>
      <ul>
        <li>利用日：<strong>${htmlEscape(row.preferred_date)}</strong></li>
        <li>預け希望時刻：<strong>${htmlEscape(row.dropoff_time)}</strong></li>
        <li>お子さま：${htmlEscape(row.child_name) || "（未入力）"}</li>
        <li>生年月日：${htmlEscape(row.child_birthdate) || "（未入力）"}</li>
      </ul>
      <p>現在のステータス：<strong>${row.status === "approved" ? "承認済（先着枠）" : "保留（承認までお待ちください）"}</strong></p>
      <p style="color:#6b7280;font-size:12px;margin-top:12px">※このメールは自動送信です。</p>
    </div>
  `;

  const u = await resend.emails.send({
    from, to: row.email, subject: subjectUser, html: bodyHtml,
  });

  let a: any = null;
  if (admin) {
    a = await resend.emails.send({
      from,
      to: admin,
      subject: `【新規予約】${row.preferred_date} ${row.dropoff_time} / ${row.guardian_name}`,
      html: `
        <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont">
          <ul>
            <li>ID：${htmlEscape(row.id ?? "")}</li>
            <li>利用日：${htmlEscape(row.preferred_date)}</li>
            <li>時刻：${htmlEscape(row.dropoff_time)}</li>
            <li>保護者：${htmlEscape(row.guardian_name)} / ${htmlEscape(row.email)}</li>
            <li>子ども：${htmlEscape(row.child_name)} / ${htmlEscape(row.child_birthdate)}</li>
            <li>ステータス：${row.status}</li>
          </ul>
        </div>
      `,
    });
  }
  return { ok: !u.error && (!admin || !a?.error), skipped: false, user: u, admin: a };
}
