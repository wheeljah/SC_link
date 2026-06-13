import { getLang, setLang } from '../i18n/translate';

// 한/EN 언어 전환 버튼. 클릭 시 언어를 저장하고 새로고침하여 전체 화면을 번역한다.
export default function LangToggle() {
  const lang = getLang();
  return (
    <button
      onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
      className="text-slate-600 hover:text-slate-900 border border-slate-300 hover:border-slate-400 rounded-md px-2 py-1 text-xs font-semibold transition-colors shrink-0"
      aria-label="Toggle language"
      title={lang === 'ko' ? 'Switch to English' : '한국어로 전환'}
    >
      {lang === 'ko' ? 'EN' : '한'}
    </button>
  );
}
