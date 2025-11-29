// api/lead.js
//
// Vercel serverless function for Solarly hero leads.
// Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from env.
// Writes into public.solarly_signups.

module.exports = async (req, res) => {
  // Only allow POST
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const { email, tier, source } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanTier =
      tier && typeof tier === "string" ? tier.trim().toLowerCase() : "unknown";
    const cleanSourceBase =
      source && typeof source === "string" ? source.trim() : "hero_form";

    // Encode tier into source so you can segment in Supabase
    const supabaseSource =
      cleanTier === "unknown"
        ? cleanSourceBase
        : `${cleanSourceBase}_${cleanTier}`;

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // This is the table you showed in the screenshot
    const LEADS_TABLE = "solarly_signups";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(
        "[api/lead] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
      );
      return res
        .status(500)
        .json({ error: "Supabase not configured on server" });
    }

    const insertUrl = `${SUPABASE_URL.replace(
      /\/+$/,
      ""
    )}/rest/v1/${LEADS_TABLE}`;

    // Match existing columns: email, source, created_at
    const payload = {
      email: cleanEmail,
      source: supabaseSource,
      created_at: new Date().toISOString(),
    };

    const supRes = await fetch(insertUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });

    if (!supRes.ok) {
      const text = await supRes.text().catch(() => "");
      console.error(
        "[api/lead] Supabase insert failed:",
        supRes.status,
        supRes.statusText,
        text
      );
      return res.status(500).json({ error: "Failed to save lead" });
    }

    console.log("[api/lead] Saved lead:", payload);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[api/lead] Unexpected error:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
};
