const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = req.body || {};
    const body =
      typeof rawBody === 'string'
        ? JSON.parse(rawBody || '{}')
        : rawBody;

    const email = (body && body.email) || null;
    const origin = body && body.origin;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    const monthlyPrice = process.env.STRIPE_PRICE_SOLARLY_ADVISOR_MONTHLY;
    const trialFeePrice = process.env.STRIPE_PRICE_SOLARLY_ADVISOR_TRIAL_FEE;

    if (!monthlyPrice || !trialFeePrice) {
      console.error('Stripe prices not set in env');
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const baseUrl =
      origin ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      'https://solarly.ai';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [
        {
          // recurring $49/mo
          price: monthlyPrice,
          quantity: 1,
        },
        {
          // one-time $1.99 trial fee
          price: trialFeePrice,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          solarly_plan: 'advisor_journal',
        },
      },
      metadata: {
        solarly_plan: 'advisor_journal',
        solarly_email: email,
      },
      success_url: `${baseUrl}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}#pricing`,
      allow_promotion_codes: false,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Error creating checkout session', err);
    return res.status(500).json({ error: 'Internal error creating checkout session' });
  }
};
