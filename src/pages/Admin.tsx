import { Link } from 'react-router-dom';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { fetchAllProfilesForAdmin, adminSetSuspended, adminSetApproved } from '@/lib/auth';
import type { UserProfile } from '@/types/auth';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { HeroMetric } from '@/components/design/HeroMetric';
import { DashboardSkeleton } from '@/components/design/skeletons';
import { Search, Users, Package, ShieldAlert, CreditCard } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function Admin() {
  const [products, setProducts] = useState<{ id: string; name: string; crop_type: string; price_per_unit: number }[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [productsRes, profilesRes] = await Promise.all([
      supabase.from('products').select('id, name, crop_type, price_per_unit').order('created_at', { ascending: false }).limit(50),
      fetchAllProfilesForAdmin(),
    ]);
    if (productsRes.error) toast.error(productsRes.error.message);
    else setProducts(productsRes.data ?? []);
    if (profilesRes.error) toast.error(profilesRes.error.message);
    else setProfiles((profilesRes.data as UserProfile[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    if (!search) return profiles;
    const q = search.toLowerCase();
    return profiles.filter((p) => p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q));
  }, [profiles, search]);

  const stats = useMemo(() => ({
    total: profiles.length,
    active: profiles.filter((p) => !p.suspended && p.approved !== false).length,
    suspended: profiles.filter((p) => p.suspended).length,
    pending: profiles.filter((p) => p.approved === false).length,
  }), [profiles]);

  const toggleSuspended = async (user: UserProfile) => {
    const { error } = await adminSetSuspended(user.id, !user.suspended);
    if (error) toast.error(error.message);
    else { toast.success(user.suspended ? 'User reactivated' : 'User suspended'); loadData(); }
  };

  const toggleApproved = async (user: UserProfile) => {
    const { profileRes, userRes } = await adminSetApproved(user.id, true);
    if (profileRes.error || userRes.error) toast.error(profileRes.error?.message ?? userRes.error?.message ?? 'Failed');
    else { toast.success('User approved'); loadData(); }
  };

  if (loading) {
    return (<><SEO title="Admin | AgroElevate" /><DashboardSkeleton /></>);
  }

  return (
    <>
      <SEO title="Admin | AgroElevate" />
      <PageHeader
        title="Admin Console"
        subtitle="Platform management & user oversight"
        actions={
          <Button variant="hero" className="gap-2" asChild>
            <Link to="/admin/payments">
              <CreditCard className="h-4 w-4" />
              Payments &amp; demo credits
            </Link>
          </Button>
        }
      />

      <div className="glass-card rounded-xl p-6 mb-8 border border-amber-500/30 bg-amber-500/5">
        <h3 className="font-semibold flex items-center gap-2 mb-2">
          <CreditCard className="h-5 w-5 text-amber-500" />
          Demo wallet funding
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Credit demonstration wallets instantly (₹1000 / ₹5000 / ₹10000 or custom). Separate from Razorpay — opens on the Payment Audit page.
        </p>
        <Button variant="secondary" asChild>
          <Link to="/admin/payments">Open Payment Audit → Demo Wallet Credit</Link>
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <HeroMetric label="Total Users" value={stats.total} icon={<Users className="h-5 w-5" />} />
        <HeroMetric label="Active" value={stats.active} />
        <HeroMetric label="Suspended" value={stats.suspended} icon={<ShieldAlert className="h-5 w-5" />} />
        <HeroMetric label="Pending Approval" value={stats.pending} />
      </div>

      <div className="glass-card rounded-xl p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h3 className="font-semibold text-lg">User Management</h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-muted/30" />
          </div>
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users found.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id} className="border-border/30">
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email}</TableCell>
                    <TableCell className="capitalize">{p.role}</TableCell>
                    <TableCell>
                      {p.suspended && <Badge variant="destructive">Suspended</Badge>}
                      {p.approved === false && <Badge variant="secondary">Pending</Badge>}
                      {!p.suspended && p.approved !== false && <Badge variant="outline" className="border-primary/30 text-primary">Active</Badge>}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/admin/payments?user=${p.id}`} title="Demo credit this user">Credit</Link>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleSuspended(p)}>{p.suspended ? 'Unsuspend' : 'Suspend'}</Button>
                      {p.approved === false && <Button size="sm" variant="hero" onClick={() => toggleApproved(p)}>Approve</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="glass-card rounded-xl p-6">
        <h3 className="font-semibold text-lg flex items-center gap-2 mb-4"><Package className="h-5 w-5" /> Recent Products ({products.length})</h3>
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex justify-between text-sm border-b border-border/30 pb-2">
              <span>{p.name} <span className="text-muted-foreground">({p.crop_type})</span></span>
              <span className="tabular-nums font-medium">₹{p.price_per_unit}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
