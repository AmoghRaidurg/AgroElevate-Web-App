import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  corsHeaders,
  json,
  getServiceClient,
  getUserFromRequest,
} from '../_shared/razorpay.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const amountInr = Number(body?.amount_inr);
    if (!Number.isFinite(amountInr) || amountInr < 1 || amountInr > 100000) {
      return json({ error: 'amount_inr must be between 1 and 100000' }, 400);
    }

    const amountPaise = Math.round(amountInr * 100);
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) {
      return json({ error: 'Razorpay Test Mode keys not configured' }, 500);
    }

    const admin = getServiceClient();
    const userId = user.id;

    const { data: receiptData, error: receiptErr } = await admin.rpc('generate_receipt_number');
    if (receiptErr) {
      return json({ error: 'Failed to generate receipt', detail: receiptErr.message }, 500);
    }
    const receiptNumber = receiptData as string;

    const auth = btoa(`${keyId}:${keySecret}`);
    const rzRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: receiptNumber,
        payment_capture: 1,
        notes: { user_id: userId, platform: body?.platform ?? 'web' },
      }),
    });

    const rzData = await rzRes.json();
    if (!rzRes.ok) {
      return json({ error: 'Razorpay order creation failed', detail: rzData }, 502);
    }

    const razorpayOrderId = rzData.id as string;
    const platform = typeof body?.platform === 'string' ? body.platform : 'web';

    const { data: intent, error: intentErr } = await admin
      .from('payment_intents')
      .insert({
        user_id: userId,
        amount_inr: amountInr,
        amount_paise: amountPaise,
        currency: 'INR',
        razorpay_order_id: razorpayOrderId,
        status: 'created',
        receipt_number: receiptNumber,
        idempotency_key: `${userId}:${razorpayOrderId}`,
        metadata: { platform },
      })
      .select('id, receipt_number')
      .single();

    if (intentErr) {
      return json({ error: 'Failed to persist payment intent', detail: intentErr.message }, 500);
    }

    return json({
      key_id: keyId,
      order_id: razorpayOrderId,
      amount_paise: amountPaise,
      currency: 'INR',
      intent_id: intent.id,
      receipt_number: intent.receipt_number,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
