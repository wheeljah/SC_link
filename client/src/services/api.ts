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
    const ctrl = new AbortController();
    const fetchTimer = setTimeout(() => ctrl.abort(), 5000); // 5s timeout
    const res = await fetch(import.meta.env.BASE_URL + 'api-config.json?v=' + Date.now(), { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(fetchTimer);
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
const api = axios.create({ withCredentials: true, timeout: 20000 }); // 20s — Render free tier spin-up 고려

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
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return Promise.reject(new Error('서버 응답 시간 초과. 잠시 후 다시 시도해주세요. (Render 무료 플랜은 첫 요청 시 30초가 소요될 수 있습니다.)'));
    }
    if (err.response?.status === 401) {
      const url = err.config?.url || '';
      // 로그인/회원가입 요청 자체의 401은 리다이렉트 제외 — 화면에서 에러 메시지 표시
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');
      if (!isAuthEndpoint) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = (import.meta.env.BASE_URL || '/') + 'login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
