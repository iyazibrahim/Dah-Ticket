import api from './api';
import type {
  Asset,
  AssetCategory,
  AssetType,
  AssetStatus,
  AssetCondition,
  Location,
  Vendor,
  ITAMStats,
  PaginatedAssetsResponse,
  AssetTicketLink,
  CreateAssetPayload,
  UpdateAssetPayload,
  ITAMSettings,
  ITAMSettingsUpdate,
  QRResolveResponse,
  ImportPreviewResponse,
  ImportPreviewOptions,
  ImportResolveDecision,
  ImportCommitResponse,
  PMReport,
  PMSummary,
  PMFinding,
  BuildPMReportPayload,
  BulkAssetActionPayload,
  BulkAssignAssetsPayload,
  BulkAssetActionResponse,
} from '../types/itam';

// --- Asset CRUD ---

export interface AssetListParams {
  page?: number;
  per_page?: number;
  search?: string;
  status_id?: number | string;
  category_id?: number | string;
  type_id?: number | string;
  location_id?: number | string;
  assigned_user_id?: number | string;
  warranty_expiring_days?: number;
  operational_bucket?: string;
}

export const itamAPI = {
  // Stats
  getStats: (params?: { location_id?: number }): Promise<{ data: ITAMStats }> =>
    api.get('/itam/stats', { params }),

  // Assets
  listAssets: (params?: AssetListParams): Promise<{ data: PaginatedAssetsResponse }> =>
    api.get('/itam/assets', { params }),

  createAsset: (data: CreateAssetPayload): Promise<{ data: { asset: Asset } }> =>
    api.post('/itam/assets', data),

  getAsset: (id: number): Promise<{ data: { asset: Asset; linked_tickets: AssetTicketLink[] } }> =>
    api.get(`/itam/assets/${id}`),

  getAssetQRToken: (id: number): Promise<{ data: { asset_id: number; token: string } }> =>
    api.get(`/itam/assets/${id}/qr-token`),

  resolveScannedQR: (token: string): Promise<{ data: QRResolveResponse }> =>
    api.post('/itam/scan/resolve', { token }),

  listMyAssets: (params?: { page?: number; per_page?: number; search?: string }): Promise<{ data: PaginatedAssetsResponse }> =>
    api.get('/itam/my-assets', { params }),

  updateAsset: (id: number, data: UpdateAssetPayload): Promise<{ data: { asset: Asset } }> =>
    api.patch(`/itam/assets/${id}`, data),

  deleteAsset: (id: number): Promise<{ data: { message: string } }> =>
    api.delete(`/itam/assets/${id}`),

  bulkDeleteAssets: (payload: BulkAssetActionPayload): Promise<{ data: BulkAssetActionResponse }> =>
    api.post('/itam/assets/bulk-delete', payload),

  bulkAssignAssets: (payload: BulkAssignAssetsPayload): Promise<{ data: BulkAssetActionResponse }> =>
    api.post('/itam/assets/bulk-assign', payload),

  searchAssets: (q: string, params?: { location_id?: number }): Promise<{ data: { assets: Asset[] } }> =>
    api.get('/itam/assets/search', { params: { q, ...params } }),

  // Reference data
  getCategories: (): Promise<{ data: AssetCategory[] }> =>
    api.get('/itam/categories'),

  getTypes: (): Promise<{ data: AssetType[] }> =>
    api.get('/itam/types'),

  getStatuses: (): Promise<{ data: AssetStatus[] }> =>
    api.get('/itam/statuses'),

  getConditions: (): Promise<{ data: AssetCondition[] }> =>
    api.get('/itam/conditions'),

  getLocations: (): Promise<{ data: Location[] }> =>
    api.get('/itam/locations'),

  getVendors: (): Promise<{ data: Vendor[] }> =>
    api.get('/itam/vendors'),

  // Admin reference data management
  createCategory: (data: Partial<AssetCategory>) => api.post('/admin/itam/categories', data),
  updateCategory: (id: number, data: Partial<AssetCategory>) => api.put(`/admin/itam/categories/${id}`, data),
  deleteCategory: (id: number) => api.delete(`/admin/itam/categories/${id}`),

  createType: (data: Partial<AssetType>) => api.post('/admin/itam/types', data),
  updateType: (id: number, data: Partial<AssetType>) => api.put(`/admin/itam/types/${id}`, data),
  deleteType: (id: number) => api.delete(`/admin/itam/types/${id}`),

  createStatus: (data: Partial<AssetStatus>) => api.post('/admin/itam/statuses', data),
  updateStatus: (id: number, data: Partial<AssetStatus>) => api.put(`/admin/itam/statuses/${id}`, data),
  deleteStatus: (id: number) => api.delete(`/admin/itam/statuses/${id}`),

  createCondition: (data: Partial<AssetCondition>) => api.post('/admin/itam/conditions', data),
  updateCondition: (id: number, data: Partial<AssetCondition>) => api.put(`/admin/itam/conditions/${id}`, data),
  deleteCondition: (id: number) => api.delete(`/admin/itam/conditions/${id}`),

  createLocation: (data: Partial<Location>) => api.post('/admin/itam/locations', data),
  updateLocation: (id: number, data: Partial<Location>) => api.put(`/admin/itam/locations/${id}`, data),
  deleteLocation: (id: number) => api.delete(`/admin/itam/locations/${id}`),

  createVendor: (data: Partial<Vendor>) => api.post('/admin/itam/vendors', data),
  updateVendor: (id: number, data: Partial<Vendor>) => api.put(`/admin/itam/vendors/${id}`, data),
  deleteVendor: (id: number) => api.delete(`/admin/itam/vendors/${id}`),

  // Ticket ↔ Asset linking
  getTicketLinkedAssets: (ticketId: number): Promise<{ data: { linked_assets: AssetTicketLink[] } }> =>
    api.get(`/tickets/${ticketId}/assets`),

  linkAssetToTicket: (
    ticketId: number,
    assetId: number,
    relationshipType: 'AFFECTED_ASSET' | 'REQUESTED_ASSET'
  ): Promise<{ data: { link: AssetTicketLink } }> =>
    api.post(`/tickets/${ticketId}/assets`, { asset_id: assetId, relationship_type: relationshipType }),

  unlinkAssetFromTicket: (ticketId: number, assetId: number): Promise<{ data: { message: string } }> =>
    api.delete(`/tickets/${ticketId}/assets/${assetId}`),

  // Admin ITAM settings
  getSettings: (): Promise<{ data: { settings: ITAMSettings } }> =>
    api.get('/admin/itam/settings'),

  updateSettings: (data: ITAMSettingsUpdate): Promise<{ data: { settings: ITAMSettings } }> =>
    api.put('/admin/itam/settings', data),

  testEmailSettings: (to: string): Promise<{ data: { message: string } }> =>
    api.post('/admin/itam/settings/test-email', { to }),

  testTelegramSettings: (): Promise<{ data: { message: string } }> =>
    api.post('/admin/itam/settings/test-telegram'),

  // Admin bulk operations
  downloadTemplate: () => api.get('/admin/itam/assets/template', { responseType: 'blob' }),
  exportAssets: (params?: { location_id?: number | string; format?: 'csv' | 'xlsx' | 'pdf' }) =>
    api.get('/admin/itam/assets/export', { responseType: 'blob', params }),
  previewImportAssets: (file: File, options?: Partial<ImportPreviewOptions>): Promise<{ data: ImportPreviewResponse }> => {
    const form = new FormData();
    form.append('file', file);
    if (options?.sheet_scope) form.append('sheet_scope', options.sheet_scope);
    if (options?.quantity_mode) form.append('quantity_mode', options.quantity_mode);
    if (options?.target_sheet_name) form.append('target_sheet_name', options.target_sheet_name);
    return api.post('/admin/itam/assets/import/preview', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  commitImportAssets: (file: File, decisions: ImportResolveDecision[], options?: Partial<ImportPreviewOptions>): Promise<{ data: ImportCommitResponse }> => {
    const form = new FormData();
    form.append('file', file);
    form.append('decisions', JSON.stringify(decisions));
    if (options?.sheet_scope) form.append('sheet_scope', options.sheet_scope);
    if (options?.quantity_mode) form.append('quantity_mode', options.quantity_mode);
    if (options?.target_sheet_name) form.append('target_sheet_name', options.target_sheet_name);
    return api.post('/admin/itam/assets/import/commit', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importAssets: (file: File, options?: Partial<ImportPreviewOptions>) => {
    const form = new FormData();
    form.append('file', file);
    if (options?.sheet_scope) form.append('sheet_scope', options.sheet_scope);
    if (options?.quantity_mode) form.append('quantity_mode', options.quantity_mode);
    if (options?.target_sheet_name) form.append('target_sheet_name', options.target_sheet_name);
    return api.post('/admin/itam/assets/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Preventive Maintenance (staff/admin)
  listPMReports: (params?: { location_id?: number | string; month?: string }): Promise<{ data: { reports: PMReport[] } }> =>
    api.get('/itam/pm/reports', { params }),

  getPMReport: (id: number): Promise<{ data: { report: PMReport } }> =>
    api.get(`/itam/pm/reports/${id}`),

  createPMReport: (data: Partial<PMReport>) =>
    api.post('/itam/pm/reports', data),

  buildPMReport: (data: BuildPMReportPayload): Promise<{ data: { report: PMReport } }> =>
    api.post('/itam/pm/reports/build', data),

  updatePMReport: (id: number, data: Partial<PMReport>) =>
    api.put(`/itam/pm/reports/${id}`, data),

  exportPMReportPDF: (id: number) =>
    api.get(`/itam/pm/reports/${id}/export/pdf`, { responseType: 'blob' }),

  listPMFindings: (params?: { location_id?: number | string; month?: string; status?: string; severity?: string; q?: string }): Promise<{ data: { findings: PMFinding[] } }> =>
    api.get('/itam/pm/findings', { params }),

  createPMFinding: (data: Partial<PMFinding>): Promise<{ data: { finding: PMFinding } }> =>
    api.post('/itam/pm/findings', data),

  uploadPMFindingPhotos: (findingId: number, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('photos', f));
    return api.post(`/itam/pm/findings/${findingId}/photos`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  updatePMFinding: (id: number, data: Partial<PMFinding>): Promise<{ data: { finding: PMFinding } }> =>
    api.put(`/itam/pm/findings/${id}`, data),

  deletePMFinding: (id: number): Promise<{ data: { message: string } }> =>
    api.delete(`/itam/pm/findings/${id}`),

  getPMSummary: (params?: { location_id?: number | string; month?: string }): Promise<{ data: { summary: PMSummary } }> =>
    api.get('/itam/pm/summary', { params }),

  triggerPMTicket: (id: number) =>
    api.post(`/itam/pm/reports/${id}/trigger-ticket`),
};
