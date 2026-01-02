import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, origin } = req.body as { email?: string; origin?: string };

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    const monthlyPrice = process.env.STRIPE_PRICE_SOLARLY_ADVISOR_MONTHLY;
    const trialFeePrice = process.env.STRIPE_PRICE_SOLARLY_ADVISOR_TRIAL_FEE;

    if (!monthlyPrice || !trialFeePrice) {
      return res.status(500).json({ error: 'Stripe prices not configured' });
    }

    const baseUrl = origin || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [
        {
          price: monthlyPrice,
          quantity: 1,
        },
        {
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
  } catch (err: any) {
    console.error('Error creating checkout session', err);
    return res.status(500).json({ error: 'Internal error creating checkout session' });
  }
}
