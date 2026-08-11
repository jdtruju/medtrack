import type { PropsWithChildren } from 'react';
import type { RolUsuario } from '@medtrack/shared';

interface ProtectedRouteProps {
  allowedRoles?: RolUsuario[];
}

export function ProtectedRoute({ children }: PropsWithChildren<ProtectedRouteProps>) {
  return <>{children}</>;
}
