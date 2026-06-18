import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from './usePermissions';

export function useLocationScope() {
  const { user } = useAuth();
  const { isFullAdmin, isSuperAdmin } = usePermissions();

  return useMemo(() => {
    const primaryLocationId = user?.primary_location_id ?? null;
    const isScoped = !!primaryLocationId && !isFullAdmin && !isSuperAdmin;
    return {
      isScoped,
      primaryLocationId,
    };
  }, [user?.primary_location_id, isFullAdmin, isSuperAdmin]);
}
