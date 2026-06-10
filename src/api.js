import axios from 'axios';
import { secureStorage, isTokenExpired, sanitizeObject, containsSQLInjection } from './security';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://backendfinal-1-production.up.railway.app/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

// ─── Request Interceptor ──────────────────────────
api.interceptors.request.use(config => {
  const token = secureStorage.getToken();

  if (token && isTokenExpired(token)) {
    secureStorage.clear();
    window.location.href = '/login';
    return Promise.reject(new Error('Token expired'));
  }

  if (token) config.headers.Authorization = `Bearer ${token}`;

  if (config.data && typeof config.data === 'object' && !(config.data instanceof FormData)) {
    const check = Object.entries(config.data).find(([, v]) =>
      typeof v === 'string' && containsSQLInjection(v)
    );
    if (check) {
      return Promise.reject(new Error(`محتوى غير مسموح في حقل: ${check[0]}`));
    }
  }

  return config;
}, error => Promise.reject(error));

// ─── Response Interceptor ─────────────────────────
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      secureStorage.clear();
      window.dispatchEvent(new CustomEvent('auth:expired'));
      window.location.href = '/login';
    }
    if (err.code === 'ECONNABORTED') {
      return Promise.reject({ response: { data: { error: 'انتهت مهلة الاتصال بالسيرفر' } } });
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────
export const login = (data) => api.post('/login', data);
export const forgotPassword = (email) => api.post('/forgot-password', { email });
export const resetPassword = (data) => api.post('/reset-password', data);
export const createFirstAdmin = () => api.post('/create-first-admin');

// ─── Medicines ────────────────────────────────────
export const getMedicines = (params) => api.get('/medicines', { params });
export const searchMedicine = (barcode) => api.get(`/medicines/search/${encodeURIComponent(barcode)}`);
export const searchMedicineByName = (q) => api.get('/medicines/search-by-name', { params: { q } });
export const addMedicine = (data) => api.post('/medicines', data);
export const updateMedicine = (id, data) => api.put(`/medicines/${encodeURIComponent(id)}`, data);
export const deleteMedicine = (id) => api.delete(`/medicines/${encodeURIComponent(id)}`);
export const getGenericSuggestions = (term) => api.get('/medicines/generic-suggestions', { params: { term } });

// 👇 الدالة الجديدة الخاصة بالذكاء الاصطناعي
export const analyzeMedicineImage = (formData) => api.post('/medicines/analyze-image', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
  timeout: 30000 
});

// ─── Users ────────────────────────────────────────
export const getUsers = () => api.get('/users');
export const addUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${encodeURIComponent(id)}`, data);
export const deleteUser = (id) => api.delete(`/users/${encodeURIComponent(id)}`);

// ─── Suppliers ────────────────────────────────────
export const getSuppliers = () => api.get('/suppliers');
export const addSupplier = (data) => api.post('/suppliers', data);
export const deleteSupplier = (id) => api.delete(`/suppliers/${encodeURIComponent(id)}`);

// ─── Sales ────────────────────────────────────────
export const createSale = (data) => api.post('/sales', data);
export const getSales = (params) => api.get('/sales', { params });
export const getSaleById = (id) => api.get(`/sales/${encodeURIComponent(id)}`);

// ─── Attendance ───────────────────────────────────
export const checkIn = (username) => api.post('/attendance/check-in', { username });
export const checkOut = (username) => api.post('/attendance/check-out', { username });
export const getAttendanceReport = (userId) => api.get(`/attendance/report/${encodeURIComponent(userId)}`);

// ─── System ───────────────────────────────────────
export const getNotifications = () => api.get('/notifications');
export const getTodayReport = () => api.get('/reports/today');
export const getHistoricalReport = (range) => api.get('/reports/historical', { params: { range } });
export const getLogs = (params) => api.get('/logs', { params });
export const addLog = (data) => api.post('/logs', data);
export const downloadBackup = () => api.get('/backup', { responseType: 'blob' });
export const restoreBackup = (formData) => api.post('/restore', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
  timeout: 120000, 
});
export const setupSecurity = (data) => api.post('/security/setup', data);
export const resetPin = (data) => api.post('/security/reset-pin', data);
export const getSecurity = () => api.get('/security');
export const dailyClosing = (data) => api.post('/daily-closing', data);

export default api;