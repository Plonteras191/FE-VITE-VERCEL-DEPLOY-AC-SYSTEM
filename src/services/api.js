import axios from 'axios';

// Base URL for Laravel API
export const API_BASE_URL = 'https://be-laravel-ac-system-263e937ff4c5.herokuapp.com/api';

// Create a pre-configured axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// API endpoints functions
export const appointmentsApi = {
  getAll: () => apiClient.get('/appointments'),
  delete: (id, reason = '') => apiClient.delete(`/appointments/${id}`, { data: { reason } }),
  accept: (id, payload) => apiClient.post(`/appointments/${id}/accept`, payload),
  complete: (id) => apiClient.post(`/appointments/${id}/complete`),
  reschedule: (id, payload) => apiClient.put(`/appointments/${id}/reschedule`, payload),
  getTechnicians: () => apiClient.get('/appointments/technicians')
};

export default apiClient;
