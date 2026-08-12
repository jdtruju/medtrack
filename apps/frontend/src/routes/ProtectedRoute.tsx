import type { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import type { RolUsuario } from '@medtrack/shared';
import { getSession } from '../lib/api';

interface ProtectedRouteProps {
  allowedRoles?: RolUsuario[];
}

export function ProtectedRoute({ children, allowedRoles }: PropsWithChildren<ProtectedRouteProps>) {
  const { token, user } = getSession();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(user.rol)) {
    return <Navigate to={user.rol === 'ADMIN' ? '/admin/dashboard' : '/patient/dashboard'} replace />;
  }

  return <>{children}</>;
}
