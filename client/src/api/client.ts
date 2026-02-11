import type {
  AnalyzeProjectRequest,
  AnalyzeResponse,
  AuthResponse,
  LogoutResponse,
  MeResponse,
  SendCodeResponse,
} from '@appshots/shared';

const API_BASE = '/api';

export interface ExportJobStatusResponse {
  jobId: string;
  projectId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stage: 'queued' | 'preparing' | 'rendering' | 'packaging' | 'saving' | 'completed' | 'failed';
  progress: number;
  message: string;
  zipUrl?: string;
  fileCount?: number;
  totalSizeBytes?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message);
  }
  return res.json();
}

async function adminRequest<T>(path: string, adminKey: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('x-admin-key', adminKey);
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message);
  }
  return res.json();
}

export const api = {
  createProject: (data: { appName: string; appDescription?: string }) =>
    request<Record<string, unknown>>('/projects', { method: 'POST', body: JSON.stringify(data) }),

  uploadScreenshots: async (projectId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('screenshots', f));
    const res = await fetch(`${API_BASE}/projects/${projectId}/upload`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },

  analyzeProject: (projectId: string, payload?: AnalyzeProjectRequest) =>
    request<AnalyzeResponse>(`/projects/${projectId}/analyze`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),

  updateProject: (projectId: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getPreviewUrl: (projectId: string, index: number, template: string, lang: string, device: string) =>
    `${API_BASE}/projects/${projectId}/preview/${index}?template=${template}&lang=${lang}&device=${device}`,

  exportProject: (projectId: string, options: Record<string, unknown>) =>
    request<{ zipUrl: string; fileCount: number; totalSizeBytes: number }>(`/projects/${projectId}/export`, {
      method: 'POST',
      body: JSON.stringify(options),
    }),

  startExportJob: (projectId: string, options: Record<string, unknown>) =>
    request<ExportJobStatusResponse>(`/projects/${projectId}/export/jobs`, {
      method: 'POST',
      body: JSON.stringify(options),
    }),

  getExportJob: (jobId: string) => request<ExportJobStatusResponse>(`/export/jobs/${jobId}`),

  getExportJobStreamUrl: (jobId: string) => `${API_BASE}/export/jobs/${jobId}/stream`,

  listProjects: () => request<{ projects: Record<string, unknown>[]; total: number }>('/projects'),

  getProject: (id: string) => request<Record<string, unknown>>(`/projects/${id}`),

  deleteProject: (id: string) => request<Record<string, unknown>>(`/projects/${id}`, { method: 'DELETE' }),

  // Auth
  sendCode: (email: string) =>
    request<SendCodeResponse>('/auth/send-code', { method: 'POST', body: JSON.stringify({ email }) }),

  verifyCode: (email: string, code: string) =>
    request<AuthResponse>('/auth/verify-code', { method: 'POST', body: JSON.stringify({ email, code }) }),

  getMe: () => request<MeResponse>('/auth/me'),

  logout: () => request<LogoutResponse>('/auth/logout', { method: 'POST' }),

  // Admin
  adminListUsers: (adminKey: string) =>
    adminRequest<{ users: Array<Record<string, unknown>>; total: number }>('/admin/users', adminKey),
  adminDeleteProject: (adminKey: string, projectId: string) =>
    adminRequest<{ message: string }>(`/admin/projects/${projectId}`, adminKey, { method: 'DELETE' }),
  adminDeleteUser: (adminKey: string, userId: string) =>
    adminRequest<{ message: string; deletedProjectCount: number }>(`/admin/users/${userId}`, adminKey, {
      method: 'DELETE',
    }),
};
