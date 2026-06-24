import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from './ProtectedRoute';

interface GuestRouteProps {
  children: React.ReactNode;
}

/** Redirect authenticated users away from login/register. */
export default function GuestRoute({ children }: GuestRouteProps) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
