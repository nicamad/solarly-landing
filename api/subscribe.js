// api/subscribe.js
// Capture Solarly signups into Supabase and optionally notify via Resend.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.json({ error: 'Method not allowed' });
  }

  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    let data = {};
    try {
      data = JSON.parse(body || '{}');
    } catch (e) {
      console.error('Invalid JSON body:', e);
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const email = (data.email || '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    console.log('New Solarly signup:', email);

    // 1) Insert into Supabase
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const base = SUPABASE_URL.replace(/\/$/, '');
      const endpoint = `${base}/rest/v1/solarly_signups`;

      try {
        console.log('Supabase endpoint:', endpoint);

        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ email }),
        });

        if (!resp.ok) {
          const txt = await resp.text();
          console.error('Supabase insert error:', resp.status, txt);
        }
      } catch (e) {
        console.error('Supabase request failed:', e);
      }
    } else {
      console.warn(
        'Supabase env vars not set; skipping DB insert.',
        'url=',
        SUPABASE_URL,
        'has_key=',
        !!SUPABASE_SERVICE_ROLE_KEY
      );
    }

    // 2) Optional Resend notification
    if (RESEND_API_KEY) {
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Solarly <no-reply@solarly.ai>',
            to: ['YOUR_EMAIL_HERE'],
            subject: 'New Solarly signup',
            text: `New signup: ${email}`,
          }),
        });

        if (!resp.ok) {
          const txt = await resp.text();
          console.error('Resend error:', resp.status, txt);
        }
      } catch (e) {
        console.error('Resend request failed:', e);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Unexpected error in /api/subscribe:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
