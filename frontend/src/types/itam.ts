// TypeScript interfaces for ITAM module entities

export interface AssetCategory {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssetType {
  id: number;
  category_id: number;
  category?: AssetCategory;
  name: string;
  requires_serial_number: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssetStatus {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssetCondition {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: number;
  name: string;
  address: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vendor {
  id: number;
  name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssetUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

export interface Asset {
  id: number;
  asset_tag: string;
  serial_number: string;
  name: string;
  description: string;
  category_id: number;
  category?: AssetCategory;
  type_id: number;
  type?: AssetType;
  status_id: number;
  status?: AssetStatus;
  condition_id?: number;
  condition?: AssetCondition;
  location_id?: number;
  location?: Location;
  vendor_id?: number;
  vendor?: Vendor;
  assigned_user_id?: number;
  assigned_user?: AssetUser;
  purchase_date?: string;
  purchase_cost?: number;
  warranty_end_date?: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
}

export interface ITAMSettings {
  id: number;
  asset_tag_prefix: string;
  auto_generate_tag: boolean;
  next_sequence: number;
  sla_low_hours: number;
  sla_medium_hours: number;
  sla_high_hours: number;
  sla_critical_hours: number;
  organization_name: string;
  logo_base64: string;
  support_email?: string;
  timezone?: string;
  notify_ticket_created?: boolean;
  notify_ticket_assigned?: boolean;
  notify_ticket_status?: boolean;
  notify_new_comment?: boolean;
  email_enabled?: boolean;
  email_sender_name?: string;
  smtp_host?: string;
  smtp_port?: string;
  smtp_username?: string;
  smtp_from_addr?: string;
  smtp_from_name?: string;
  has_smtp_password?: boolean;
  telegram_enabled?: boolean;
  telegram_chat_id?: string;
  has_telegram_bot_token?: boolean;
  kb_max_upload_mb?: number;
}

export interface ITAMSettingsUpdate extends Partial<ITAMSettings> {
  smtp_password?: string;
  clear_smtp_password?: boolean;
  telegram_bot_token?: string;
  clear_telegram_bot_token?: boolean;
}

export interface PMFailureLog {
  id: number;
  report_id: number;
  asset_id?: number;
  failure_type: string;
  description: string;
  started_at: string;
  resolved_at?: string;
}

export interface PMCalibrationRecord {
  id: number;
  report_id: number;
  asset_id?: number;
  task_name: string;
  result: string;
  notes: string;
  calibrated_at: string;
}

export interface PMChecklistItem {
  id: number;
  report_id: number;
  item_name: string;
  is_completed: boolean;
  notes: string;
}

export interface PMReport {
  id: number;
  location_id: number;
  location?: Location;
  month: string;
  network_avg_utilization?: number;
  network_peak_utilization?: number;
  downtime_minutes?: number;
  summary: string;
  triggered_ticket_id?: number;
  created_by: number;
  updated_by: number;
  failures?: PMFailureLog[];
  calibrations?: PMCalibrationRecord[];
  checklist_items?: PMChecklistItem[];
  findings?: PMFinding[];
  created_at: string;
  updated_at: string;
}

export interface PMFinding {
  id: number;
  location_id: number;
  location?: Location;
  asset_id?: number;
  asset?: Asset;
  device_label: string;
  asset_type_label: string;
  finding_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  status: 'open' | 'monitor' | 'resolved' | string;
  threshold_state: 'normal' | 'warning' | 'danger' | string;
  utilization_percent?: number;
  temperature_celsius?: number;
  description: string;
  recommendation: string;
  replacement_required: boolean;
  observed_at: string;
  resolved_at?: string;
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
}

export interface BuildPMReportPayload {
  location_id: number;
  month: string;
  summary?: string;
  finding_ids: number[];
  network_avg_utilization?: number;
  network_peak_utilization?: number;
  downtime_minutes?: number;
}

export interface PMSummary {
  total_reports: number;
  total_findings?: number;
  total_failures?: number;
  urgent_issues?: number;
  pending_follow_ups?: number;
  mttr_hours: number;
  mtbf_hours: number;
}

export interface QRResolveResponse {
  asset: Asset;
  redirect_to: string;
}

export interface AssetTicketLink {
  id: number;
  asset_id: number;
  asset?: Asset;
  ticket_id: number;
  ticket?: {
    id: number;
    title: string;
    status: string;
  };
  relationship_type: 'AFFECTED_ASSET' | 'REQUESTED_ASSET';
  created_at: string;
  created_by: number;
}

export interface ITAMStats {
  total_assets: number;
  unassigned: number;
  warranty_expiring_soon: number;
  warranty_expired: number;
  by_status: Array<{ status_id: number; name: string; count: number }>;
  by_location?: Array<{ location_id: number | null; name: string; count: number }>;
  operational?: {
    in_use: number;
    need_attention: number;
    out_of_service: number;
    unassigned: number;
  };
}

export interface ImportPreviewAssetMatch {
  id: number;
  name: string;
  asset_tag: string;
  serial_number: string;
  location: string;
  category: string;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ImportPreviewRow {
  line: number;
  name: string;
  asset_tag: string;
  serial_number: string;
  category: string;
  type: string;
  status: string;
  condition: string;
  location: string;
  vendor: string;
  notes: string;
  conflict_status: 'new' | 'exact_duplicate' | 'possible_duplicate' | 'invalid';
  validation_errors: string[];
  matched_assets: ImportPreviewAssetMatch[];
}

export interface ImportPreviewSummary {
  total_rows: number;
  effective_total_rows?: number;
  new_rows: number;
  effective_new_rows?: number;
  exact_duplicates: number;
  effective_exact_duplicates?: number;
  possible_duplicates: number;
  effective_possible_duplicates?: number;
  invalid_rows: number;
  effective_invalid_rows?: number;
}

export type ImportSheetScope = 'masterlist_only' | 'all_sheets';
export type ImportQuantityMode = 'single_asset_per_row' | 'expand_quantity';

export interface ImportPreviewOptions {
  sheet_scope: ImportSheetScope;
  quantity_mode: ImportQuantityMode;
  target_sheet_name: string;
}

export interface ImportSheetSummary {
  name: string;
  raw_rows: number;
  used_rows: number;
  matched: boolean;
  has_header: boolean;
}

export interface ImportPreviewMetadata {
  source_type: string;
  total_sheets: number;
  processed_sheets: number;
  matched_sheet_names: string[];
  sheet_summaries: ImportSheetSummary[];
  raw_row_count: number;
  effective_row_count: number;
}

export interface ImportPreviewResponse {
  summary: ImportPreviewSummary;
  options?: ImportPreviewOptions;
  metadata?: ImportPreviewMetadata;
  rows: ImportPreviewRow[];
}

export type ImportResolveAction = 'create_new' | 'merge_existing' | 'skip';

export interface ImportResolveDecision {
  line: number;
  action: ImportResolveAction;
  target_asset_id?: number;
}

export interface ImportCommitResponse {
  options?: ImportPreviewOptions;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface PaginatedAssetsResponse {
  assets: Asset[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface CreateAssetPayload {
  asset_tag?: string;
  auto_generate_tag?: boolean;
  serial_number?: string;
  name: string;
  description?: string;
  category_id: number;
  type_id: number;
  status_id: number;
  condition_id?: number;
  location_id?: number;
  vendor_id?: number;
  assigned_user_id?: number;
  purchase_date?: string;
  purchase_cost?: number;
  warranty_end_date?: string;
  notes?: string;
}

export type UpdateAssetPayload = Partial<CreateAssetPayload> & { is_active?: boolean };
