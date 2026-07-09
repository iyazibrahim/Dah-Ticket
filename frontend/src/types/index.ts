export type UserRole = 'employee' | 'it_agent' | 'manager' | 'admin';

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  is_admin: boolean;
  is_super_admin: boolean;
  is_active: boolean;
  organization_id?: number;
  primary_location_id?: number | null;
  created_at: string;
}

export type KBApprovalStatus = 'draft' | 'pending_approval' | 'published' | 'rejected';

export interface KBArticle {
  id: number;
  title: string;
  content: string;
  category: string;
  tags: string[];
  is_published: boolean;
  approval_status: KBApprovalStatus;
  view_count: number;
  author_id: number;
  author?: User;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'on_hold' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: 'incident' | 'service_request' | 'problem' | 'change';
  category: string;
  location_id?: number;
  location?: { id: number; name: string };
  organization_id?: number;
  routed_to_org_id?: number;
  is_central_intake?: boolean;
  requester_id: number;
  requester?: User;
  assignee_id?: number;
  assignee?: User;
  comments?: Comment[];
  attachments?: Attachment[];
  due_date?: string;
  resolved_at?: string;
  closed_at?: string;
  hold_reason?: 'awaiting_customer' | 'awaiting_vendor' | 'pending_approval' | 'blocked' | 'other';
  hold_note?: string;
  is_escalated?: boolean;
  escalated_at?: string;
  assignment_accepted?: boolean;
  assignment_accepted_at?: string;
  sla_paused_at?: string;
  resolution_code?: 'fixed' | 'workaround' | 'user_education' | 'duplicate' | 'cannot_reproduce' | 'cancelled';
  resolution_note?: string;
  closure_code?: 'resolved_confirmed' | 'auto_closed' | 'duplicate' | 'cancelled';
  closure_note?: string;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: number;
  content: string;
  is_internal: boolean;
  ticket_id: number;
  author_id: number;
  author?: User;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: number;
  file_name: string;
  file_size: number;
  mime_type: string;
  file_url: string;
  uploader_id: number;
  uploader?: User;
  ticket_id?: number;
  comment_id?: number;
  created_at: string;
}

export interface AuditLog {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number;
  user_id: number;
  user?: User;
  old_values?: string;
  new_values?: string;
  details?: string;
  ip_address?: string;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link?: string;
  created_at: string;
}
