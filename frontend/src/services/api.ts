import axios from 'axios';
import type { Ticket } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dahticket_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses globally — redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('dahticket_token');
      localStorage.removeItem('dahticket_user');
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// --- Auth API ---
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  register: (data: { first_name: string; last_name: string; email: string; password: string }) =>
    api.post('/auth/register', data),

	getMe: () => api.get('/auth/me'),

  updateMe: (data: { first_name?: string; last_name?: string; old_password?: string; new_password?: string }) =>
    api.put('/auth/me', data),
};

// --- Ticket API ---
export interface TicketFilters {
  page?: number;
  per_page?: number;
  status?: string;
  priority?: string;
  assignee_id?: number;
  unassigned?: boolean;
  search?: string;
}

export interface PaginatedResponse<T> {
  tickets: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface PersonalTicketStats {
  month: number;
  year: number;
  accepted_this_month: number;
  resolved_this_month: number;
  currently_assigned: number;
  requested_this_month: number;
  closed_this_month: number;
}

export const ticketAPI = {
  list: (filters?: TicketFilters) =>
    api.get<PaginatedResponse<Ticket>>('/tickets', { params: filters }),

  get: (id: number) =>
    api.get<{ ticket: Ticket }>(`/tickets/${id}`),

  create: (data: { title: string; description: string; priority?: string; type?: string; category?: string }) =>
    api.post<{ ticket: Ticket }>('/tickets', data),

  update: (id: number, data: Partial<Pick<Ticket, 'title' | 'description' | 'status' | 'priority' | 'type' | 'category'> & { assignee_id: number | null }>) =>
    api.put<{ ticket: Ticket }>(`/tickets/${id}`, data),

  accept: (id: number) =>
    api.post<{ ticket: Ticket }>(`/tickets/${id}/accept`),

  delete: (id: number) =>
    api.delete(`/tickets/${id}`),

  stats: () =>
    api.get<{ stats: Record<string, number> }>('/tickets/stats'),

  personalStats: () =>
    api.get<{ stats: PersonalTicketStats }>('/tickets/personal-stats'),
};

// --- Comment API ---
export const commentAPI = {
  add: (ticketId: number, data: { content: string; is_internal?: boolean }) =>
    api.post(`/tickets/${ticketId}/comments`, data),

  update: (ticketId: number, commentId: number, data: { content: string }) =>
    api.put(`/tickets/${ticketId}/comments/${commentId}`, data),

  delete: (ticketId: number, commentId: number) =>
    api.delete(`/tickets/${ticketId}/comments/${commentId}`),
};

// --- Attachment API ---
export const attachmentAPI = {
  upload: (ticketId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/tickets/${ticketId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  list: (ticketId: number) =>
    api.get(`/tickets/${ticketId}/attachments`),

  delete: (ticketId: number, attachmentId: number) =>
    api.delete(`/tickets/${ticketId}/attachments/${attachmentId}`),

  download: (ticketId: number, attachmentId: number) =>
    api.get(`/tickets/${ticketId}/attachments/${attachmentId}/download`, { responseType: 'blob' }),

  downloadUrl: (ticketId: number, attachmentId: number) =>
    `${API_BASE_URL}/tickets/${ticketId}/attachments/${attachmentId}/download`,
};

// --- Admin API ---
export const adminAPI = {
  listUsers: (params?: { page?: number; per_page?: number; role?: string; search?: string; is_active?: string }) =>
    api.get('/admin/users', { params }),

  getUser: (id: number) => api.get(`/admin/users/${id}`),

  createUser: (data: { first_name: string; last_name: string; email: string; password: string; role: string; is_admin?: boolean }) =>
    api.post('/admin/users', data),

  updateUser: (id: number, data: Record<string, unknown>) =>
    api.put(`/admin/users/${id}`, data),

  listAgents: () => api.get('/agents'),
};

// --- Notification API ---
export const notificationAPI = {
  list: () => api.get('/notifications'),
  markRead: (id: number) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

export default api;

