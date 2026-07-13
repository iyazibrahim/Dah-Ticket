import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { User } from '../types';

export type Permissions = {
  user: User | null;
  isEmployee: boolean;
  isITAgent: boolean;
  isManager: boolean;
  isStaff: boolean;
  isDelegatedAdmin: boolean;
  isFullAdmin: boolean;
  isSuperAdmin: boolean;
  hasAdminElevation: boolean;
  canAcceptTickets: boolean;
  canAssignAnyone: boolean;
  canAssignITAgents: boolean;
  canPromoteAdmin: boolean;
  canAccessSettings: boolean;
  canManageUsers: boolean;
  canEditAnyWiki: boolean;
  canManageKBCategories: boolean;
  canPublishWiki: boolean;
  isSiteIntakeStaff: boolean;
};

function computePermissions(user: User | null): Permissions {
  const role = user?.role;
  const isAdmin = user?.is_admin ?? false;
  const isSuperAdmin = user?.is_super_admin ?? false;
  const isEmployee = role === 'employee';
  const isITAgent = role === 'it_agent';
  const isManager = role === 'manager';
  const isLegacyAdmin = role === 'admin';
  const hasAdminElevation = isAdmin || isSuperAdmin || isLegacyAdmin;
  const isDelegatedAdmin = isITAgent && isAdmin;
  const isFullAdmin = isSuperAdmin || (isManager && isAdmin) || (isLegacyAdmin && isAdmin);
  const isStaff = isITAgent || isManager || isLegacyAdmin;
  const isSiteIntakeStaff = isStaff && !!user?.primary_location_id && !isFullAdmin && !isSuperAdmin;

  return {
    user,
    isEmployee,
    isITAgent,
    isManager,
    isStaff,
    isDelegatedAdmin,
    isFullAdmin,
    isSuperAdmin,
    hasAdminElevation,
    canAcceptTickets: isStaff,
    canAssignAnyone: isManager || isFullAdmin || isLegacyAdmin,
    canAssignITAgents: isManager || isFullAdmin || isLegacyAdmin || isDelegatedAdmin,
    canPromoteAdmin: isFullAdmin,
    canAccessSettings: isFullAdmin,
    canManageUsers: isFullAdmin,
    canEditAnyWiki: isManager || hasAdminElevation,
    canManageKBCategories: hasAdminElevation,
    canPublishWiki: isManager || hasAdminElevation,
    isSiteIntakeStaff,
  };
}

export function usePermissions(): Permissions {
  const { user } = useAuth();
  return useMemo(() => computePermissions(user), [user]);
}
