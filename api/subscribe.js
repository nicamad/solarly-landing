const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const email = String(body.email || body.leadEmail || "").trim();

    if (!email) return res.status(400).json({ ok: false, error: "Email is required" });
    if (email.length > 254) return res.status(400).json({ ok: false, error: "Email is too long" });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: "Invalid email" });

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const RESEND_FROM = process.env.RESEND_FROM; // e.g. "Solarly <support@solarly.ai>"
    const RESEND_TO = process.env.RESEND_TO || process.env.RESEND_NOTIFY_TO || "support@solarly.ai";

    if (!RESEND_API_KEY || !RESEND_FROM) {
      return res.status(500).json({
        ok: false,
        error: "Missing RESEND_API_KEY or RESEND_FROM env vars"
      });
    }

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [RESEND_TO],
        subject: "Solarly lead (landing page)",
        text: `New lead:\n\nemail: ${email}\n\nsource: /api/subscribe\nua: ${req.headers["user-agent"] || ""}\n`
      })
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return res.status(502).json({ ok: false, error: `Resend error ${r.status}`, detail: txt.slice(0, 300) });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
};
