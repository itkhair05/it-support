const API_BASE = '/api';

export async function request(endpoint, options = {}) {
  const token = localStorage.getItem('helpdesk_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  // If uploading file, remove Content-Type to let browser set boundary
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Có lỗi xảy ra khi gửi yêu cầu');
  }

  return data;
}

export const api = {
  // Auth & Profile
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getProfile: () => request('/profile'),
  updateProfile: (data) => request('/profile/update', { method: 'POST', body: JSON.stringify(data) }),
  changePassword: (data) => request('/profile/change-password', { method: 'POST', body: JSON.stringify(data) }),

  // Tickets
  getTickets: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/tickets${query ? '?' + query : ''}`);
  },
  createTicket: (data) => request('/tickets', { method: 'POST', body: JSON.stringify(data) }),
  getTicketDetail: (id) => request(`/tickets/${id}`),
  updateTicketStatus: (id, status) => request(`/tickets/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  assignTicket: (id, assignee_id) => request(`/tickets/${id}/assign`, { method: 'POST', body: JSON.stringify({ assignee_id }) }),
  getActivityLogs: (id) => request(`/tickets/${id}/logs`),
  rateTicket: (id, data) => request(`/tickets/${id}/rate`, { method: 'POST', body: JSON.stringify(data) }),

  // Comments
  getComments: (ticketId) => request(`/tickets/${ticketId}/comments`),
  createComment: (ticketId, data) => request(`/tickets/${ticketId}/comments`, { method: 'POST', body: JSON.stringify(data) }),

  // Attachments
  uploadAttachment: (ticketId, formData) => request(`/tickets/${ticketId}/attachments`, { method: 'POST', body: formData }),

  // Departments & Categories
  getDepartments: () => request('/departments'),
  createDepartment: (data) => request('/departments', { method: 'POST', body: JSON.stringify(data) }),
  deleteDepartment: (id) => request(`/departments/${id}`, { method: 'DELETE' }),
  getCategories: () => request('/categories'),

  // Assets (IT Asset Management)
  getAssets: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/assets${query ? '?' + query : ''}`);
  },
  createAsset: (data) => request('/assets', { method: 'POST', body: JSON.stringify(data) }),
  updateAssetStatus: (id, status) => request(`/assets/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  deleteAsset: (id) => request(`/assets/${id}`, { method: 'DELETE' }),

  // Users (Admin)
  getUsers: (role = '') => request(`/users${role ? '?role=' + role : ''}`),
  createUser: (data) => request('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  toggleUserStatus: (id) => request(`/admin/users/${id}/toggle-status`, { method: 'POST' }),
  resetUserPassword: (id) => request(`/admin/users/${id}/reset-password`, { method: 'POST' }),

  // Stats & Notifications
  getStats: () => request('/stats'),
  getNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}`, { method: 'POST' }),
};
