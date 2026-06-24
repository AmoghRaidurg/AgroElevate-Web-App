import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  corsHeaders,
  json,
  getServiceClient,
  hmacSha256Hex,
} from '../_shared/razorpay.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
  if (!webhookSecret) {
    return json({ error: 'Webhook secret not configured' }, 500);
  }

  const rawBody = await req.text();
  const signature = req.headers.get('X-Razorpay-Signature') ?? '';
  const expected = await hmacSha256Hex(webhookSecret, rawBody);

  if (!signature || signature !== expected) {
    return json({ error: 'Invalid signature' }, 400);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const eventId = (payload.id as string) ?? req.headers.get('x-razorpay-event-id') ?? `evt_${Date.now()}`;
  const eventType = (payload.event as string) ?? 'unknown';
  const admin = getServiceClient();

  const { data: existing } = await admin
    .from('razorpay_webhook_events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle();

  if (existing) {
    await admin.from('razorpay_webhook_events').insert({
      event_id: `${eventId}_dup_${Date.now()}`,
      event_type: eventType,
      payload,
      status: 'duplicate',
      duplicate_of_event_id: eventId,
    }).catch(() => undefined);

    return json({ ok: true, duplicate: true });
  }

  const payloadObj = payload.payload as Record<string, Record<string, Record<string, unknown>>> | undefined;
  const paymentEntity = payloadObj?.payment?.entity as Record<string, unknown> | undefined;
  const razorpayOrderId = paymentEntity?.order_id as string | undefined;
  const razorpayPaymentId = paymentEntity?.id as string | undefined;
  const amountPaise = paymentEntity?.amount as number | undefined;
  const method = paymentEntity?.method as string | undefined;
  const createdAt = paymentEntity?.created_at as number | undefined;

  try {
    if (eventType === 'payment.captured' && razorpayOrderId && razorpayPaymentId && amountPaise) {
      const { error: settleErr } = await admin.rpc('confirm_wallet_deposit', {
        p_razorpay_order_id: razorpayOrderId,
        p_razorpay_payment_id: razorpayPaymentId,
        p_amount_paise: amountPaise,
        p_payment_method: method ?? null,
        p_paid_at_epoch: createdAt ?? null,
      });

      if (settleErr) throw new Error(settleErr.message);

      await admin.from('razorpay_webhook_events').insert({
        event_id: eventId,
        event_type: eventType,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_order_id: razorpayOrderId,
        payload,
        status: 'processed',
      });
    } else if (eventType === 'payment.failed' && razorpayOrderId) {
      await admin.rpc('mark_payment_intent_failed', {
        p_razorpay_order_id: razorpayOrderId,
        p_failure_reason: (paymentEntity?.error_description as string) ?? 'payment_failed',
      });

      await admin.from('razorpay_webhook_events').insert({
        event_id: eventId,
        event_type: eventType,
        razorpay_payment_id: razorpayPaymentId ?? null,
        razorpay_order_id: razorpayOrderId,
        payload,
        status: 'processed',
      });
    } else {
      await admin.from('razorpay_webhook_events').insert({
        event_id: eventId,
        event_type: eventType,
        razorpay_payment_id: razorpayPaymentId ?? null,
        razorpay_order_id: razorpayOrderId ?? null,
        payload,
        status: 'ignored',
      });
    }

    return json({ ok: true });
  } catch (e) {
    await admin.from('razorpay_webhook_events').insert({
      event_id: eventId,
      event_type: eventType,
      razorpay_payment_id: razorpayPaymentId ?? null,
      razorpay_order_id: razorpayOrderId ?? null,
      payload,
      status: 'failed',
      failure_reason: String(e),
    });

    return json({ error: String(e) }, 500);
  }
});
