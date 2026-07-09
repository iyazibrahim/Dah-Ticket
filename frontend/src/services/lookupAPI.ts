import api from './api';

export interface LookupItem {
  key: string;
  label: string;
  sort_order: number;
  metadata?: Record<string, unknown>;
}

export interface AdminLookupRow extends LookupItem {
  id: number;
  group: string;
  is_active: boolean;
}

export const lookupAPI = {
  list: (group: string) => api.get<{ group: string; items: LookupItem[] }>(`/lookups/${group}`),

  adminList: (group?: string) =>
    api.get<{ lookups: AdminLookupRow[] }>('/admin/lookups', { params: group ? { group } : {} }),

  create: (group: string, data: { key: string; label: string; sort_order?: number; metadata?: Record<string, unknown>; is_active?: boolean }) =>
    api.post(`/admin/lookups/${group}`, data),

  update: (group: string, id: number, data: Partial<{ label: string; sort_order: number; metadata: Record<string, unknown>; is_active: boolean }>) =>
    api.put(`/admin/lookups/${group}/${id}`, data),

  delete: (group: string, id: number) => api.delete(`/admin/lookups/${group}/${id}`),
};
