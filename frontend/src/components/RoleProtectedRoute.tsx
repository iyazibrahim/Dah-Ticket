import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';

type Guard = 'staff' | 'fullAdmin' | 'managerOrAdmin';

interface Props {
  guard: Guard;
  children: React.ReactNode;
  redirectTo?: string;
}

export default function RoleProtectedRoute({ guard, children, redirectTo = '/' }: Props) {
  const perms = usePermissions();

  const allowed =
    (guard === 'staff' && perms.isStaff) ||
    (guard === 'fullAdmin' && perms.isFullAdmin) ||
    (guard === 'managerOrAdmin' && (perms.isManager || perms.hasAdminElevation));

  if (!allowed) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
