const SUPABASE_URL = process.env.SUPABASE_URL; // e.g. https://<ref>.supabase.co
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE_NAME = 'solarly_signups';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || 'Solarly <hi@solarly.ai>';
const RESEND_INTERNAL_ALERT_EMAIL =
  process.env.RESEND_INTERNAL_ALERT_EMAIL || '';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};

  const leadEmail = (email || '').trim();
  const internalEmail = (RESEND_INTERNAL_ALERT_EMAIL || '').trim();

  console.info('New Solarly signup:', leadEmail);
  console.info('Supabase base URL:', SUPABASE_URL);
  console.info('Supabase table:', TABLE_NAME);
  console.info('Resend lead to:', leadEmail);
  console.info('Resend internal to:', internalEmail);

  if (!leadEmail) {
    console.error('Missing email in request body');
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase env vars');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const endpoint = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}`;
  console.info('Supabase endpoint:', endpoint);

  try {
    // 1) Insert into Supabase
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ email: leadEmail, source: 'hero_form' }),
    });

    const text = await response.text();
    console.info('Supabase status:', response.status, 'body:', text);

    if (!response.ok) {
      console.error('Supabase insert failed:', text);
      return res.status(500).json({ error: 'Supabase insert failed' });
    }

    // 2) Fire Resend emails (best-effort)
    if (RESEND_API_KEY) {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      };

      const tasks = [];

      // Welcome email to lead
      tasks.push(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            from: RESEND_FROM_EMAIL,
            to: leadEmail, // simple, trimmed address
            subject: "Welcome to Solarly's private beta ☀️",
            html: `
              <p>Hey there,</p>
              <p>You're on the list for <strong>Solarly</strong>, the AI trading co-pilot.</p>
              <p>We'll reach out as new wings, signals, and co-pilot features go live.</p>
              <p>In the meantime, keep that BTC sink humming 🪙☀️</p>
              <p>– Solarly</p>
            `,
          }),
        })
      );

      // Internal alert (only if configured)
      if (internalEmail) {
        tasks.push(
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              from: RESEND_FROM_EMAIL,
              to: internalEmail,
              subject: 'New Solarly signup',
              html: `
                <p>New lead on <strong>solarly.ai</strong>:</p>
                <p><strong>Email:</strong> ${leadEmail}</p>
                <p>Source: hero_form</p>
              `,
            }),
          })
        );
      }

      const results = await Promise.allSettled(tasks);
      console.info('Resend results:', JSON.stringify(results));
    } else {
      console.warn('RESEND_API_KEY not set; skipping Resend emails');
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Supabase/Resend request failed:', err);
    return res
      .status(500)
      .json({ error: 'Network error talking to Supabase/Resend' });
  }
}
