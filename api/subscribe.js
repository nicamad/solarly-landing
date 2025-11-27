const SUPABASE_URL = process.env.SUPABASE_URL; // e.g. https://<ref>.supabase.co
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE_NAME = 'solarly_signups';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL; // "Solarly <hi@solarly.ai>"
const RESEND_INTERNAL_ALERT_EMAIL =
  process.env.RESEND_INTERNAL_ALERT_EMAIL || 'hi@solarly.ai';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};
  const leadEmail =
    typeof email === 'string' ? email.trim().toLowerCase() : '';

  console.info('New Solarly signup:', leadEmail);
  console.info('Supabase base URL:', SUPABASE_URL);
  console.info('Supabase table:', TABLE_NAME);
  console.info('Resend lead to:', leadEmail);
  console.info('Resend internal to:', RESEND_INTERNAL_ALERT_EMAIL);

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
    //
    // 1) Insert into Supabase waitlist
    //
    const supabaseRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        email: leadEmail,
        source: 'hero_form',
        status: 'waitlisted',
      }),
    });

    const supabaseBody = await supabaseRes.json().catch(() => null);
    console.info(
      'Supabase status:',
      supabaseRes.status,
      'body:',
      JSON.stringify(supabaseBody)
    );

    if (!supabaseRes.ok) {
      console.error('Supabase insert failed:', supabaseBody);
      return res.status(500).json({ error: 'Failed to save signup' });
    }

    //
    // 2) Resend emails (welcome + internal)
    //
    if (RESEND_API_KEY && RESEND_FROM_EMAIL) {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      };

      const welcomeSubject = "Welcome to Solarly's private beta 🌞";

      const welcomeTextLines = [
        'Hey there,',
        '',
        "You’re on the list for Solarly, the AI trading co-pilot.",
        'We’ll reach out as new wings, signals, and co-pilot features go live.',
        '',
        'In the meantime, keep that BTC sink humming ☀️',
        '',
        '– Solarly',
      ];
      const welcomeText = welcomeTextLines.join('\n');

      const welcomeHtml = `
        <p>Hey there,</p>
        <p>You’re on the list for <strong>Solarly</strong>, the AI trading co-pilot.</p>
        <p>We’ll reach out as new wings, signals, and co-pilot features go live.</p>
        <p>In the meantime, keep that BTC sink humming ☀️</p>
        <p>– Solarly</p>
      `;

      const tasks = [];

      // 2a) Welcome email to lead
      tasks.push(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            from: RESEND_FROM_EMAIL,
            to: [leadEmail],
            subject: welcomeSubject,
            text: welcomeText,
            html: welcomeHtml,
          }),
        })
      );

      // 2b) Internal notification to you
      if (RESEND_INTERNAL_ALERT_EMAIL) {
        const internalTextLines = [
          'New lead on solarly.ai',
          '',
          `Email: ${leadEmail}`,
          'Source: hero_form',
        ];

        const internalHtml = `
          <p>New lead on <strong>solarly.ai</strong>:</p>
          <p><strong>Email:</strong> ${leadEmail}</p>
          <p>Source: hero_form</p>
        `;

        tasks.push(
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              from: RESEND_FROM_EMAIL,
              to: [RESEND_INTERNAL_ALERT_EMAIL],
              subject: 'New Solarly signup',
              text: internalTextLines.join('\n'),
              html: internalHtml,
            }),
          })
        );
      }

      const results = await Promise.allSettled(tasks);
      console.info('Resend results:', JSON.stringify(results));
    } else {
      console.warn(
        'RESEND_API_KEY or RESEND_FROM_EMAIL not set; skipping Resend emails'
      );
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Supabase/Resend request failed:', err);
    return res
      .status(500)
      .json({ error: 'Network error talking to Supabase/Resend' });
  }
};
