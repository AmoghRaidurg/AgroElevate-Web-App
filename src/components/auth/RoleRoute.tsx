import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from './ProtectedRoute';

interface RoleRouteProps {
  children: React.ReactNode;
  allowedRole: string;
}

export default function RoleRoute({ children, allowedRole }: RoleRouteProps) {
  const { profile, loading } = useAuth();

  return (
    <ProtectedRoute>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : profile?.role === allowedRole ? (
        <>{children}</>
      ) : (
        <Navigate to="/dashboard" replace />
      )}
    </ProtectedRoute>
  );
}
