import { getLang, setLang } from '../i18n/translate';

// 'KR/EN' 언어 전환 버튼 — 현재 언어를 강조 표시. 클릭 시 전환 후 새로고침.
export default function LangToggle() {
  const lang = getLang();
  return (
    <button
      onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
      className="flex items-center border border-slate-300 hover:border-slate-400 rounded-md px-2 py-1 shrink-0 transition-colors"
      aria-label="Toggle language"
      title={lang === 'ko' ? 'Switch to English' : '한국어로 전환'}
    >
      <span className={`text-xs font-semibold ${lang === 'ko' ? 'text-teal-600' : 'text-slate-400'}`}>KR</span>
      <span className="text-slate-300 mx-0.5 text-xs">/</span>
      <span className={`text-xs font-semibold ${lang === 'en' ? 'text-teal-600' : 'text-slate-400'}`}>EN</span>
    </button>
  );
}
