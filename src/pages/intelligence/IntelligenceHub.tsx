import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSkeleton } from '@/components/design/skeletons';
import FarmerInsights from './FarmerInsights';
import TraderInsights from './TraderInsights';
import IndustrialistInsights from './IndustrialistInsights';

/** Routes to role-appropriate intelligence dashboard without redesigning marketplace UI. */
export default function IntelligenceHub() {
  const { profile, loading } = useAuth();

  if (loading) return <DashboardSkeleton />;

  const role = profile?.role;
  if (role === 'farmer') return <FarmerInsights />;
  if (role === 'middleman') return <TraderInsights />;
  if (role === 'industrialist') return <IndustrialistInsights />;

  return <Navigate to="/dashboard" replace />;
}
