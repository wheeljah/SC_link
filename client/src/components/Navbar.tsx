import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2 text-xl font-bold text-slate-900">
          <span aria-hidden="true">🔬</span>
          <span>ScholarLink</span>
        </Link>
        <div className="flex min-w-0 items-center gap-4 overflow-x-auto text-sm text-slate-600 scrollbar-hide">
          <a className="shrink-0 hover:text-brand-700" href="#search">논문 찾기</a>
          <a className="shrink-0 hover:text-brand-700" href="#sources">검색 소스</a>
          <a className="shrink-0 hover:text-brand-700" href="#guide">이용 안내</a>
        </div>
      </div>
    </nav>
  );
}
