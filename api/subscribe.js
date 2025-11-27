// api/subscribe.js
// Simple Vercel Serverless Function to capture emails via Resend

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
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const email = (data.email || '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    // Optional: log to Vercel logs for now
    console.log('New Solarly signup:', email);

    // If you want to use Resend, set RESEND_API_KEY in Vercel env vars
    if (process.env.RESEND_API_KEY) {
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Solarly <no-reply@solarly.ai>',
            to: ['YOUR_EMAIL_HERE'], // change this to your real inbox
            subject: 'New Solarly signup',
            text: `New signup: ${email}`,
          }),
        });

        if (!resp.ok) {
          const txt = await resp.text();
          console.error('Resend error:', txt);
        }
      } catch (e) {
        console.error('Resend request failed:', e);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
