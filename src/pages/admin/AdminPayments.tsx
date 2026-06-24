import { useCallback, useEffect, useState } from 'react';

import { Link, useSearchParams } from 'react-router-dom';

import { SEO } from '@/components/SEO';

import { PageHeader } from '@/components/layout/PageHeader';

import { HeroMetric } from '@/components/design/HeroMetric';

import { DashboardSkeleton } from '@/components/design/skeletons';

import { Button } from '@/components/ui/button';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { toast } from 'sonner';

import { AdminDemoWalletCreditPanel } from '@/components/admin/AdminDemoWalletCreditPanel';

import {

  fetchPaymentAuditSummary,

  fetchSuccessfulPayments,

  fetchFailedPayments,

  fetchWebhookFailures,

  fetchDuplicateWebhooks,

  formatIst,

  exportCsv,

  type PaymentAuditSummary,

  type SuccessfulPaymentRow,

  type FailedPaymentRow,

  type WebhookEventRow,

} from '@/lib/paymentAudit';

import {

  fetchDemoCreditAudit,

  probeDemoCreditBackend,

  type DemoCreditAuditRow,

} from '@/lib/demoWalletCredit';



export default function AdminPayments() {
  const [searchParams] = useSearchParams();
  const prefillUserId = searchParams.get('user') ?? '';

  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<PaymentAuditSummary | null>(null);

  const [successful, setSuccessful] = useState<SuccessfulPaymentRow[]>([]);

  const [failed, setFailed] = useState<FailedPaymentRow[]>([]);

  const [webhookFailures, setWebhookFailures] = useState<WebhookEventRow[]>([]);

  const [duplicates, setDuplicates] = useState<WebhookEventRow[]>([]);

  const [demoCredits, setDemoCredits] = useState<DemoCreditAuditRow[]>([]);

  const [backendOk, setBackendOk] = useState(true);



  const loadAudit = useCallback(async () => {

    const results = await Promise.allSettled([

      fetchPaymentAuditSummary(),

      fetchSuccessfulPayments(),

      fetchFailedPayments(),

      fetchWebhookFailures(),

      fetchDuplicateWebhooks(),

      fetchDemoCreditAudit(),

    ]);



    const labels = ['summary', 'successful', 'failed', 'webhooks', 'duplicates', 'demo credits'] as const;

    const errors: string[] = [];



    results.forEach((result, i) => {

      if (result.status === 'rejected') {

        errors.push(`${labels[i]}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);

      }

    });



    if (results[0].status === 'fulfilled') setSummary(results[0].value);

    if (results[1].status === 'fulfilled') setSuccessful(results[1].value);

    if (results[2].status === 'fulfilled') setFailed(results[2].value);

    if (results[3].status === 'fulfilled') setWebhookFailures(results[3].value);

    if (results[4].status === 'fulfilled') setDuplicates(results[4].value);

    if (results[5].status === 'fulfilled') setDemoCredits(results[5].value);



    if (errors.length) {

      toast.error(`Some audit data failed to load (${errors.length}). Demo credit panel remains available.`);

      console.warn('[AdminPayments] partial load:', errors);

    }

  }, []);



  const load = useCallback(async () => {

    setLoading(true);

    try {

      const probe = await probeDemoCreditBackend();

      setBackendOk(probe.rpcAvailable && probe.auditTableAvailable);

      if (!probe.rpcAvailable || !probe.auditTableAvailable) {

        toast.error(

          probe.detail?.includes('Admin only')

            ? 'Demo credit backend is ready. Sign in as admin to use it.'

            : 'Demo credit migration may be missing. Apply migration 017.',

        );

      }

      await loadAudit();

    } catch (e) {

      toast.error(e instanceof Error ? e.message : 'Failed to load payment audit data');

    } finally {

      setLoading(false);

    }

  }, [loadAudit]);



  useEffect(() => { load(); }, [load]);



  if (loading) {

    return (<><SEO title="Payment Audit | AgroElevate" /><DashboardSkeleton /></>);

  }



  return (

    <>

      <SEO title="Payment Audit | AgroElevate" />

      <PageHeader

        title="Payment Audit"

        subtitle="Razorpay settlements, demo wallet credits, and webhook idempotency"

        actions={

          <div className="flex gap-2">

            <Button variant="outline" asChild>

              <Link to="/admin">Admin console</Link>

            </Button>

            <Button variant="outline" onClick={load}>Refresh</Button>

          </div>

        }

      />



      {!backendOk && (

        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">

          Demo credit RPC or audit table not detected. Run migration{' '}

          <code className="text-xs">20250625100017_demo_wallet_credit.sql</code> in Supabase SQL Editor.

        </div>

      )}



      <AdminDemoWalletCreditPanel initialUserId={prefillUserId} onCredited={() => loadAudit()} />



      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">

        <HeroMetric label="Paid today (IST)" value={summary?.paid_today ?? 0} />

        <HeroMetric label="Failed today" value={summary?.failed_today ?? 0} />

        <HeroMetric label="Demo credits today" value={summary?.demo_credits_today ?? 0} />

        <HeroMetric label="Webhook failures (24h)" value={summary?.webhook_failures_24h ?? 0} />

        <HeroMetric label="Duplicate webhooks (24h)" value={summary?.duplicate_webhooks_24h ?? 0} />

      </div>



      <Tabs defaultValue="demo" className="glass-card rounded-xl p-6">

        <TabsList className="mb-4 flex flex-wrap h-auto">

          <TabsTrigger value="demo">Demo credits ({demoCredits.length})</TabsTrigger>

          <TabsTrigger value="successful">Successful ({successful.length})</TabsTrigger>

          <TabsTrigger value="failed">Failed ({failed.length})</TabsTrigger>

          <TabsTrigger value="webhooks">Webhook failures ({webhookFailures.length})</TabsTrigger>

          <TabsTrigger value="duplicates">Duplicates ({duplicates.length})</TabsTrigger>

        </TabsList>



        <TabsContent value="demo">

          <div className="flex justify-end mb-2">

            <Button size="sm" variant="outline" onClick={() => exportCsv('demo-wallet-credits.csv', demoCredits as unknown as Record<string, unknown>[])}>Export CSV</Button>

          </div>

          {demoCredits.length === 0 ? (

            <p className="text-sm text-muted-foreground py-6 text-center">No demo credits yet. Use the panel above to credit a user.</p>

          ) : (

            <Table>

              <TableHeader>

                <TableRow>

                  <TableHead>Target user</TableHead>

                  <TableHead>Admin</TableHead>

                  <TableHead>Amount</TableHead>

                  <TableHead>Wallet history</TableHead>

                  <TableHead>At (IST)</TableHead>

                </TableRow>

              </TableHeader>

              <TableBody>

                {demoCredits.map((r) => (

                  <TableRow key={r.id}>

                    <TableCell className="font-mono text-xs">{r.target_user_id}</TableCell>

                    <TableCell className="font-mono text-xs">{r.admin_user_id.slice(0, 8)}…</TableCell>

                    <TableCell>₹{Number(r.amount_inr).toLocaleString('en-IN')}</TableCell>

                    <TableCell className="font-mono text-xs">{r.wallet_history_id.slice(0, 8)}…</TableCell>

                    <TableCell className="text-xs">{formatIst(r.created_at)}</TableCell>

                  </TableRow>

                ))}

              </TableBody>

            </Table>

          )}

        </TabsContent>



        <TabsContent value="successful">

          <div className="flex justify-end mb-2">

            <Button size="sm" variant="outline" onClick={() => exportCsv('successful-payments.csv', successful as unknown as Record<string, unknown>[])}>Export CSV</Button>

          </div>

          <Table>

            <TableHeader>

              <TableRow>

                <TableHead>Receipt</TableHead>

                <TableHead>User</TableHead>

                <TableHead>Amount</TableHead>

                <TableHead>Paid (IST)</TableHead>

                <TableHead>Payment ID</TableHead>

              </TableRow>

            </TableHeader>

            <TableBody>

              {successful.map((r) => (

                <TableRow key={r.id}>

                  <TableCell className="font-mono text-xs">{r.receipt_number}</TableCell>

                  <TableCell className="text-xs">{r.user_id.slice(0, 8)}…</TableCell>

                  <TableCell>₹{Number(r.amount_inr).toLocaleString('en-IN')}</TableCell>

                  <TableCell className="text-xs">{formatIst(r.paid_at_ist)}</TableCell>

                  <TableCell className="font-mono text-xs">{r.razorpay_payment_id}</TableCell>

                </TableRow>

              ))}

            </TableBody>

          </Table>

        </TabsContent>



        <TabsContent value="failed">

          <Table>

            <TableHeader>

              <TableRow>

                <TableHead>User</TableHead>

                <TableHead>Amount</TableHead>

                <TableHead>Status</TableHead>

                <TableHead>Reason</TableHead>

                <TableHead>Created</TableHead>

              </TableRow>

            </TableHeader>

            <TableBody>

              {failed.map((r) => (

                <TableRow key={r.id}>

                  <TableCell className="text-xs">{r.user_id.slice(0, 8)}…</TableCell>

                  <TableCell>₹{Number(r.amount_inr).toLocaleString('en-IN')}</TableCell>

                  <TableCell>{r.status}</TableCell>

                  <TableCell className="text-xs">{r.failure_reason ?? '—'}</TableCell>

                  <TableCell className="text-xs">{formatIst(r.created_at)}</TableCell>

                </TableRow>

              ))}

            </TableBody>

          </Table>

        </TabsContent>



        <TabsContent value="webhooks">

          <Table>

            <TableHeader>

              <TableRow>

                <TableHead>Event</TableHead>

                <TableHead>Type</TableHead>

                <TableHead>Payment</TableHead>

                <TableHead>Reason</TableHead>

                <TableHead>At</TableHead>

              </TableRow>

            </TableHeader>

            <TableBody>

              {webhookFailures.map((r) => (

                <TableRow key={r.id}>

                  <TableCell className="font-mono text-xs">{r.event_id}</TableCell>

                  <TableCell>{r.event_type}</TableCell>

                  <TableCell className="font-mono text-xs">{r.razorpay_payment_id ?? '—'}</TableCell>

                  <TableCell className="text-xs">{r.failure_reason ?? '—'}</TableCell>

                  <TableCell className="text-xs">{formatIst(r.processed_at)}</TableCell>

                </TableRow>

              ))}

            </TableBody>

          </Table>

        </TabsContent>



        <TabsContent value="duplicates">

          <Table>

            <TableHeader>

              <TableRow>

                <TableHead>Event</TableHead>

                <TableHead>Duplicate of</TableHead>

                <TableHead>Payment</TableHead>

                <TableHead>At</TableHead>

              </TableRow>

            </TableHeader>

            <TableBody>

              {duplicates.map((r) => (

                <TableRow key={r.id}>

                  <TableCell className="font-mono text-xs">{r.event_id}</TableCell>

                  <TableCell className="font-mono text-xs">{r.duplicate_of_event_id ?? '—'}</TableCell>

                  <TableCell className="font-mono text-xs">{r.razorpay_payment_id ?? '—'}</TableCell>

                  <TableCell className="text-xs">{formatIst(r.processed_at)}</TableCell>

                </TableRow>

              ))}

            </TableBody>

          </Table>

        </TabsContent>

      </Tabs>

    </>

  );

}


