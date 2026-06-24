import { supabase } from './supabaseClient';

export interface PaymentAuditSummary {
  paid_today: number;
  failed_today: number;
  webhook_failures_24h: number;
  duplicate_webhooks_24h: number;
  demo_credits_today?: number;
}

export interface SuccessfulPaymentRow {
  id: string;
  receipt_number: string;
  user_id: string;
  amount_inr: number;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  paid_at_ist: string;
  wallet_history_id: string;
  payment_intents?: { metadata?: Record<string, unknown> };
}

export interface FailedPaymentRow {
  id: string;
  user_id: string;
  amount_inr: number;
  razorpay_order_id: string | null;
  status: string;
  failure_reason: string | null;
  created_at: string;
}

export interface WebhookEventRow {
  id: string;
  event_id: string;
  event_type: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  status: string;
  failure_reason: string | null;
  duplicate_of_event_id: string | null;
  processed_at: string;
}

export async function fetchPaymentAuditSummary(): Promise<PaymentAuditSummary> {
  const { data, error } = await supabase.rpc('get_payment_audit_summary');
  if (error) throw error;
  return data as PaymentAuditSummary;
}

export async function fetchSuccessfulPayments(): Promise<SuccessfulPaymentRow[]> {
  const { data, error } = await supabase
    .from('payment_receipts')
    .select('id, receipt_number, user_id, amount_inr, razorpay_order_id, razorpay_payment_id, paid_at_ist, wallet_history_id')
    .order('paid_at_ist', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as SuccessfulPaymentRow[];
}

export async function fetchFailedPayments(): Promise<FailedPaymentRow[]> {
  const { data, error } = await supabase
    .from('payment_intents')
    .select('id, user_id, amount_inr, razorpay_order_id, status, failure_reason, created_at')
    .in('status', ['failed', 'expired'])
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as FailedPaymentRow[];
}

export async function fetchWebhookFailures(): Promise<WebhookEventRow[]> {
  const { data, error } = await supabase
    .from('razorpay_webhook_events')
    .select('id, event_id, event_type, razorpay_order_id, razorpay_payment_id, status, failure_reason, duplicate_of_event_id, processed_at')
    .eq('status', 'failed')
    .order('processed_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as WebhookEventRow[];
}

export async function fetchDuplicateWebhooks(): Promise<WebhookEventRow[]> {
  const { data, error } = await supabase
    .from('razorpay_webhook_events')
    .select('id, event_id, event_type, razorpay_order_id, razorpay_payment_id, status, failure_reason, duplicate_of_event_id, processed_at')
    .eq('status', 'duplicate')
    .order('processed_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as WebhookEventRow[];
}

export function formatIst(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

export function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
