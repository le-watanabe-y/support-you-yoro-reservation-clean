// lib/mailer.ts — Resend 版の最小実装

type Result = { ok: true } | { ok: false; message: string };

export async function sendReservationCompletedMail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<Result> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, message: "RESEND_API_KEY not set" };

  const { Resend } = await import("resend");
  const resend = new Resend(key);

  try {
    const r = await resend.emails.send({
      from: "no-reply@example.com",
      to,
      subject,
      html,
    });
    if (r.error) return { ok: false, message: String(r.error) };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "send error" };
  }
}
