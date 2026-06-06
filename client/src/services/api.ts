/// <reference types="vite/client" />
import axios from 'axios';

let baseURL = '/api/v1'; // fallback: relative path (Vite proxy for localhost dev)
let backendOrigin = ''; // e.g. 'https://scholarlink-api.onrender.com'

/** Returns the full backend origin (e.g. for constructing /uploads/ links). Empty string means same-origin. */
export function getBackendOrigin(): string { return backendOrigin; }

/** Returns the fully-resolved API base URL (includes /api/v1). */
export function getApiBaseURL(): string { return baseURL; }

async function initApiConfig() {
  try {
    // Load config from public/api-config.json (deployed with the app)
    const res = await fetch('/api-config.json?v=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const config = await res.json();
      if (config.backend) {
        backendOrigin = config.backend;
        baseURL = config.backend + '/api/v1';
        console.log('[api] Backend URL set to:', config.backend);
      }
    }
  } catch {
    // Use env var or relative path
    if (import.meta.env.VITE_API_BASE_URL) {
      backendOrigin = import.meta.env.VITE_API_BASE_URL;
      baseURL = import.meta.env.VITE_API_BASE_URL + '/api/v1';
      console.log('[api] Backend URL from env:', import.meta.env.VITE_API_BASE_URL);
    } else {
      console.warn('[api] Config load failed, using relative path /api/v1');
    }
  }
}

// Export so components can await backend URL resolution before making requests
export const initPromise = initApiConfig();

// No static baseURL — set dynamically in interceptor after initPromise resolves
const api = axios.create({ withCredentials: true });

api.interceptors.request.use(async (config) => {
  await initPromise; // wait for api-config.json to load (no-op on subsequent calls)
  config.baseURL = baseURL;
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
      // Use Vite's BASE_URL so redirect works on both GitHub Pages (/SC_link/) and localhost (/)
      window.location.href = (import.meta.env.BASE_URL || '/') + 'login';
    }
    return Promise.reject(err);
  }
);

export default api;
