import api from './api';
import type { KBArticle } from '../types';

export const kbAPI = {
  list: (params?: { page?: number; per_page?: number; search?: string; category?: string }) =>
    api.get<{ articles: KBArticle[]; total: number; page: number; per_page: number; total_pages: number }>('/kb', { params }),

  get: (id: number) => api.get<{ article: KBArticle }>(`/kb/${id}`),

  create: (data: { title: string; content: string; category: string; tags?: string }) =>
    api.post<{ article: KBArticle }>('/kb', data),

  update: (id: number, data: Partial<{ title: string; content: string; category: string; tags: string; is_published: boolean }>) =>
    api.put<{ article: KBArticle }>(`/kb/${id}`, data),

  delete: (id: number) => api.delete(`/kb/${id}`),

  submitForApproval: (id: number) => api.post<{ article: KBArticle }>(`/kb/${id}/submit-for-approval`),

  approve: (id: number) => api.post<{ article: KBArticle }>(`/kb/${id}/approve`),

  reject: (id: number) => api.post<{ article: KBArticle }>(`/kb/${id}/reject`),

  categories: () => api.get<{ categories: string[] }>('/kb/categories'),

  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return api.post<{ url: string }>('/kb/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
