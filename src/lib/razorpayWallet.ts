import { supabase } from './supabaseClient';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export interface TopUpOrderResponse {
  key_id: string;
  order_id: string;
  amount_paise: number;
  currency: string;
  intent_id: string;
  receipt_number: string;
}

export interface PaymentReceipt {
  id: string;
  receipt_number: string;
  amount_inr: number;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  payment_method: string | null;
  paid_at_ist: string;
  wallet_history_id: string;
}

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(script);
  });
}

export async function createWalletTopUpOrder(amountInr: number): Promise<TopUpOrderResponse> {
  const { data, error } = await supabase.functions.invoke('razorpay-create-order', {
    body: { amount_inr: amountInr, platform: 'web' },
  });
  if (error) throw error;
  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  return data as TopUpOrderResponse;
}

export async function openRazorpayCheckout(
  order: TopUpOrderResponse,
  userEmail: string | undefined,
  userName: string | undefined,
  onProcessing: () => void,
): Promise<void> {
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error('Razorpay SDK unavailable');

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: order.key_id,
      amount: order.amount_paise,
      currency: order.currency,
      order_id: order.order_id,
      name: 'AgroElevate',
      description: `Wallet top-up · ${order.receipt_number}`,
      prefill: { email: userEmail, name: userName },
      theme: { color: '#16a34a' },
      handler: () => {
        onProcessing();
        resolve();
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    });
    rzp.open();
  });
}

export async function pollWalletAfterPayment(
  userId: string,
  intentId: string,
  options?: { maxAttempts?: number; intervalMs?: number },
): Promise<boolean> {
  const maxAttempts = options?.maxAttempts ?? 30;
  const intervalMs = options?.intervalMs ?? 2000;

  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await supabase
      .from('payment_intents')
      .select('status')
      .eq('id', intentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (data?.status === 'paid') return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

export async function fetchPaymentReceipts(userId: string): Promise<PaymentReceipt[]> {
  const { data, error } = await supabase
    .from('payment_receipts')
    .select('id, receipt_number, amount_inr, razorpay_order_id, razorpay_payment_id, payment_method, paid_at_ist, wallet_history_id')
    .eq('user_id', userId)
    .order('paid_at_ist', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as PaymentReceipt[];
}

export function formatIstDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}
