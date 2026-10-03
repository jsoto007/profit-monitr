/**
 * Transactional email. Uses Resend's HTTP API when RESEND_API_KEY is set;
 * otherwise the message is logged to the server console so the flow can be
 * exercised locally without a mail provider.
 */
export async function sendEmail(opts: { to: string; subject: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Profit Monitr <onboarding@resend.dev>";
  if (!key) {
    console.log(`[email → ${opts.to}] ${opts.subject}\n${opts.text}\n`);
    return { delivered: false as const };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, text: opts.text }),
  });
  if (!res.ok) {
    console.error("Resend error", res.status, await res.text());
    return { delivered: false as const };
  }
  return { delivered: true as const };
}

export function emailConfigured() {
  return !!process.env.RESEND_API_KEY;
}
