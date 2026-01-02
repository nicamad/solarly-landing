export default async function handler(req, res) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return res.status(500).json({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
    }

    // Lightweight read: counts as activity, no writes.
    const r = await fetch(`${url}/rest/v1/solarly_signups?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(500).json({ ok: false, error: `Supabase REST error ${r.status}`, detail: txt.slice(0, 300) });
    }

    return res.status(200).json({ ok: true, ts: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
