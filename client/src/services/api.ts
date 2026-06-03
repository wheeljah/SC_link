/// <reference types="vite/client" />
import axios from 'axios';

let baseURL = '/api/v1'; // fallback: relative path (Vite proxy for localhost dev)

async function initApiConfig() {
  try {
    // Load config from public/api-config.json (deployed with the app)
    const res = await fetch('/api-config.json?v=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const config = await res.json();
      if (config.backend) {
        baseURL = config.backend + '/api/v1';
        console.log('[api] Backend URL set to:', config.backend);
      }
    }
  } catch {
    // Use env var or relative path
    if (import.meta.env.VITE_API_BASE_URL) {
      baseURL = import.meta.env.VITE_API_BASE_URL + '/api/v1';
      console.log('[api] Backend URL from env:', import.meta.env.VITE_API_BASE_URL);
    } else {
      console.warn('[api] Config load failed, using relative path /api/v1');
    }
  }
}

initApiConfig();

const api = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;