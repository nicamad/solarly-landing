const SUPABASE_URL = process.env.SUPABASE_URL; // e.g. https://<ref>.supabase.co
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE_NAME = 'solarly_signups';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL; // e.g. "Solarly <hi@solarly.ai>"
const RESEND_INTERNAL_EMAIL =
  process.env.RESEND_INTERNAL_EMAIL || 'hi@solarly.ai';

export default async function handler(req, res) {
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
  console.info('Resend internal to:', RESEND_INTERNAL_EMAIL);

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
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: \`Bearer \${SUPABASE_SERVICE_ROLE_KEY}\`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        email: leadEmail,
        source: 'hero_form',
        status: 'waitlisted',
      }),
    });

    const text = await response.text();
    console.info('Supabase status:', response.status, 'body:', text);

    if (!response.ok) {
      console.error('Supabase insert failed:', text);
      return res.status(500).json({ error: 'Supabase insert failed' });
    }

    //
    // 2) Fire Resend emails (welcome + internal alert), non-critical
    //
    if (RESEND_API_KEY && RESEND_FROM_EMAIL) {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: \`Bearer \${RESEND_API_KEY}\`,
      };

      // Gentle first-name guess from email local-part
      const localPart = leadEmail.split('@')[0] || '';
      const firstChunk = localPart.split(/[._-]/)[0] || '';
      const safeFirstName = firstChunk.replace(/[^a-z0-9]/gi, '');
      const greetingName = safeFirstName || 'there';

      const welcomeSubject = "You're on the Solarly waitlist 🌞";

      const welcomeTextLines = [
        \`Hey \${greetingName},\`,
        '',
        'Thanks for signing up on solarly.ai — you’re on the waitlist for Solarly’s private beta.',
        '',
        'What to expect next:',
        '- Occasional build updates (no spam).',
        '- A heads-up when your wing is ready (Coinbase or Roth-Tastytrade).',
        '- A simple way to opt out any time.',
        '',
        'If this wasn’t you, just reply and we’ll remove you.',
        '',
        '– Solarly',
        'hi@solarly.ai',
      ];

      const welcomeText = welcomeTextLines.join('\n');

      const welcomeHtml = `
        <p>Hey ${greetingName},</p>
        <p>
          Thanks for signing up on <strong>solarly.ai</strong> —
          you’re on the waitlist for Solarly’s private beta.
        </p>
        <p>What to expect next:</p>
        <ul>
          <li>Occasional build updates (no spam).</li>
          <li>A heads-up when your wing is ready (Coinbase or Roth-Tastytrade).</li>
          <li>A simple way to opt out any time.</li>
        </ul>
        <p>
          If this wasn’t you, just reply and we’ll remove you.
        </p>
        <p>– Solarly<br/>hi@solarly.ai</p>
      `;

      const tasks = [];

      // 2a) Welcome email to the lead
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
      if (RESEND_INTERNAL_EMAIL) {
        const internalTextLines = [
          'New lead on solarly.ai',
          '',
          \`Email: \${leadEmail}\`,
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
              to: [RESEND_INTERNAL_EMAIL],
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
}
