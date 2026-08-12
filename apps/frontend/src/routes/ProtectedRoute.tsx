import type { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import type { RolUsuario } from '@medtrack/shared';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  allowedRoles?: RolUsuario[];
}

export function ProtectedRoute({ children, allowedRoles }: PropsWithChildren<ProtectedRouteProps>) {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(user.rol)) {
    return <Navigate to={user.rol === 'ADMIN' ? '/admin/dashboard' : '/patient/dashboard'} replace />;
  }

  return <>{children}</>;
}
