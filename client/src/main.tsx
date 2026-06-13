import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { initI18n } from './i18n/translate';

// Vite base('/' 로컬, '/SC_link/' 배포)에서 끝 슬래시 제거 → router basename
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// 저장된 언어가 EN이면 전체 화면을 실시간 번역
initI18n();
