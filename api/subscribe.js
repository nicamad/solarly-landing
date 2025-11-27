// api/subscribe.js
// Capture Solarly signups into Supabase and optionally notify via Resend.

const SUPABASE_URL_ENV = process.env.SUPABASE_URL;
// Fallback to explicit URL so we're 100% sure it's correct.
const SUPABASE_BASE_URL =
  (SUPABASE_URL_ENV && SUPABASE_URL_ENV.replace(/\/$/, '')) ||
  'https://tlbwkifhwwwqiwnzzopz.supabase.co';

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

const SUPABASE_TABLE_ENDPOINT = `${SUPABASE_BASE_URL}/rest/v1/solarly_signups`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.json({ error: 'Method not allowed' });
  }

  try {
    // Read body
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    // Parse JSON
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
    if (SUPABASE_SERVICE_ROLE_KEY) {
      try {
        console.log('Supabase config:', {
          endpoint: SUPABASE_TABLE_ENDPOINT,
          hasKey: !!SUPABASE_SERVICE_ROLE_KEY,
        });

        const resp = await fetch(SUPABASE_TABLE_ENDPOINT, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          // keep it minimal: just email column
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
      console.warn('SUPABASE_SERVICE_ROLE_KEY missing; skipping DB insert.');
    }

    // 2) Optional Resend notification (still safe to leave off)
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
