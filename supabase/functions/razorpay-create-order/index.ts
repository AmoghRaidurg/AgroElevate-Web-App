// Supabase Edge Function: Razorpay order creation (demo-ready)
// Save as supabase/functions/razorpay-create-order/index.ts
// Requires secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, currency } = await req.json();
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
      return json({ error: 'Razorpay secrets not configured' }, 500);
    }

    const auth = btoa(`${keyId}:${keySecret}`);
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount, currency, payment_capture: 1 })
    });

    const data = await res.json();
    if (!res.ok) return json({ error: data }, 400);
    return json(data, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}, { port: 8000 });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}
