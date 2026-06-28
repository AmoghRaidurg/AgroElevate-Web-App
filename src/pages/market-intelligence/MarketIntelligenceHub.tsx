import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSkeleton } from '@/components/design/skeletons';
import FarmerMarketIntelligence from './FarmerMarketIntelligence';
import TraderMarketIntelligence from './TraderMarketIntelligence';
import IndustrialistMarketIntelligence from './IndustrialistMarketIntelligence';

/** Routes to role-appropriate Market Intelligence dashboard — separate from Commerce Intelligence. */
export default function MarketIntelligenceHub() {
  const { profile, loading } = useAuth();

  if (loading) return <DashboardSkeleton />;

  const role = profile?.role;
  if (role === 'farmer') return <FarmerMarketIntelligence />;
  if (role === 'middleman') return <TraderMarketIntelligence />;
  if (role === 'industrialist') return <IndustrialistMarketIntelligence />;
  if (role === 'admin') return <Navigate to="/admin/market-intelligence" replace />;

  return <Navigate to="/dashboard" replace />;
}
