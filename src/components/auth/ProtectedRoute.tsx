import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PageLoading } from '@/components/design/skeletons';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireApproved?: boolean;
}

export default function ProtectedRoute({ children, requireApproved = true }: ProtectedRouteProps) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoading message="Authenticating…" />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (session.user && !session.user.email_confirmed_at) {
    return <Navigate to="/verify-email" replace state={{ email: session.user.email }} />;
  }

  if (profile?.suspended) {
    return <Navigate to="/suspended" replace />;
  }

  if (requireApproved && profile && profile.approved === false) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
}
