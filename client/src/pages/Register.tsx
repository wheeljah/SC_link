import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const REGIONS = [
  { value: 'seoul',    label: '서울특별시' },
  { value: 'busan',    label: '부산광역시' },
  { value: 'daegu',    label: '대구광역시' },
  { value: 'incheon',  label: '인천광역시' },
  { value: 'gwangju',  label: '광주광역시' },
  { value: 'daejeon',  label: '대전광역시' },
  { value: 'ulsan',    label: '울산광역시' },
  { value: 'sejong',   label: '세종특별자치시' },
  { value: 'gyeonggi', label: '경기도' },
  { value: 'gangwon',  label: '강원특별자치도' },
  { value: 'chungbuk', label: '충청북도' },
  { value: 'chungnam', label: '충청남도' },
  { value: 'jeonbuk',  label: '전북특별자치도' },
  { value: 'jeonnam',  label: '전라남도' },
  { value: 'gyeongbuk',label: '경상북도' },
  { value: 'gyeongnam',label: '경상남도' },
  { value: 'jeju',     label: '제주특별자치도' },
];

const REGION_MAP: Record<string, string> = {
  seoul: 'seoul', busan: 'busan', daegu: 'daegu', incheon: 'incheon',
  gwangju: 'gwangju', daejeon: 'daejeon', ulsan: 'ulsan', sejong: 'sejong',
  gyeonggi: 'gyeonggi', gangwon: 'gangwon',
  'north chungcheong': 'chungbuk', 'south chungcheong': 'chungnam',
  'north jeolla': 'jeonbuk', 'south jeolla': 'jeonnam',
  'north gyeongsang': 'gyeongbuk', 'south gyeongsang': 'gyeongnam',
  jeju: 'jeju',
};

function mapIpRegion(raw: string): string {
  if (!raw) return '';
  const key = raw.toLowerCase()
    .replace(/-do$/, '').replace(/-si$/, '')
    .replace(/ special.*/, '').trim();
  for (const [k, v] of Object.entries(REGION_MAP)) {
    if (key === k || key.startsWith(k) || k.startsWith(key)) return v;
  }
  return '';
}

// 가입 가능한 국가 — ISO 3166-1 alpha-2 + 영문 표기 (학술 서비스라 일반 연구국가 중심)
const COUNTRIES: { code: string; name: string }[] = [
  { code: 'KR', name: 'South Korea (대한민국)' },
  { code: 'US', name: 'United States' },
  { code: 'JP', name: 'Japan (日本)' },
  { code: 'CN', name: 'China (中国)' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'SG', name: 'Singapore' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IE', name: 'Ireland' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'PT', name: 'Portugal' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'FI', name: 'Finland' },
  { code: 'DK', name: 'Denmark' },
  { code: 'PL', name: 'Poland' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'RU', name: 'Russia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'IL', name: 'Israel' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'EG', name: 'Egypt' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'CA', name: 'Canada' },
  { code: 'MX', name: 'Mexico' },
  { code: 'BR', name: 'Brazil' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
];

export default function Register() {
  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '', nickname: '',
    countryCode: '', region: '',
  });
  const [geoDetecting, setGeoDetecting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [serverMsg, setServerMsg] = useState('');
  const [verifyLink, setVerifyLink] = useState('');

  // IP 기반 국가 + (KR이면) 행정구역 자동 감지
  useEffect(() => {
    (async () => {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch('https://ipapi.co/json/', { signal: ctrl.signal });
        clearTimeout(tid);
        const data = await res.json() as { region?: string; country?: string };
        const country = (data.country || '').toUpperCase();
        if (country && country.length === 2) {
          const patch: Partial<typeof form> = { countryCode: country };
          if (country === 'KR') {
            const detected = mapIpRegion(data.region || '');
            if (detected) patch.region = detected;
          }
          setForm(f => ({ ...f, ...patch }));
        }
      } catch { /* 실패 시 사용자가 직접 선택 */ }
      finally { setGeoDetecting(false); }
    })();
  }, []);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => {
        const next = { ...f, [k]: e.target.value };
        // 국가가 KR이 아닌 걸로 바뀌면 region 초기화
        if (k === 'countryCode' && e.target.value !== 'KR' && f.region) {
          next.region = '';
        }
        return next;
      });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!form.countryCode) {
      setError('국가를 선택해주세요.');
      return;
    }
    if (form.countryCode === 'KR' && !form.region) {
      setError('한국 사용자는 행정구역을 선택해주세요.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        email: form.email,
        password: form.password,
        nickname: form.nickname || undefined,
        countryCode: form.countryCode,
        region: form.countryCode === 'KR' ? form.region : undefined,
      });
      setDevMode(!!res.data.devMode);
      setServerMsg(res.data.message || '');
      if (res.data.previewUrl) setVerifyLink(res.data.previewLink ?? res.data.previewUrl);
      setDone(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">{devMode ? '📮' : '📧'}</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {devMode ? '테스트 메일 발송 완료' : '인증 이메일을 발송했습니다'}
          </h2>

          {devMode ? (
            <div className="text-left bg-teal-50 border border-teal-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold text-teal-800 mb-1">📮 Ethereal 임시 메일함으로 발송됨</p>
              <p className="text-sm text-teal-600 mb-3">아래 버튼으로 인증 메일을 확인하세요.</p>
              {verifyLink ? (
                <a
                  href={verifyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors mb-2"
                >
                  📬 Ethereal 메일함에서 인증 메일 보기 →
                </a>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      const res = await api.get(`/auth/dev-verify-link?email=${encodeURIComponent(form.email)}`);
                      setVerifyLink(res.data.verifyLink);
                    } catch { alert('링크 조회 실패. 서버 터미널을 확인하세요.'); }
                  }}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors mb-2"
                >
                  🔗 인증 링크 직접 가져오기
                </button>
              )}
              <p className="text-xs text-teal-400 mt-1">실제 Gmail 발송: server/.env → SMTP_USER · SMTP_PASS 설정</p>
            </div>
          ) : (
            <p className="text-slate-500 text-sm mb-4">
              <strong>{form.email}</strong>으로 발송된 인증 링크를 클릭해주세요.<br />
              <span className="text-slate-400">(유효 시간: 24시간)</span>
            </p>
          )}

          {!devMode && (
            <button
              onClick={async () => {
                try { await api.post('/auth/resend-verification', { email: form.email }); alert('재발송했습니다.'); }
                catch { alert('잠시 후 다시 시도해주세요.'); }
              }}
              className="text-sm text-teal-600 hover:underline"
            >
              인증 메일 재발송
            </button>
          )}
          <div className="mt-6">
            <Link to="/login" className="text-slate-500 hover:text-slate-800 text-sm">로그인 페이지로 이동</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="text-3xl">🔬</Link>
          <h1 className="text-xl font-bold text-slate-900 mt-2">ScholarLink 회원가입</h1>
          <p className="text-sm text-slate-500 mt-1">이메일로 가입하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">이메일 *</label>
            <input
              type="email" value={form.email} onChange={set('email')} required
              autoComplete="email" placeholder="your@email.com"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              비밀번호 * <span className="text-slate-400 font-normal">(영문+숫자 8자 이상)</span>
            </label>
            <input
              type="password" value={form.password} onChange={set('password')} required
              autoComplete="new-password" placeholder="••••••••"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호 확인 *</label>
            <input
              type="password" value={form.confirmPassword} onChange={set('confirmPassword')} required
              autoComplete="new-password" placeholder="••••••••"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              닉네임 <span className="text-slate-400 font-normal">(선택)</span>
            </label>
            <input
              type="text" value={form.nickname} onChange={set('nickname')}
              autoComplete="nickname" placeholder="연구자"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* 국가 선택 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              국가 *
              {geoDetecting && (
                <span className="ml-2 text-xs text-teal-500 font-normal">위치 감지 중…</span>
              )}
              {!geoDetecting && form.countryCode && (
                <span className="ml-2 text-xs text-slate-400 font-normal">IP 기반 자동 선택됨 (변경 가능)</span>
              )}
            </label>
            <select
              value={form.countryCode}
              onChange={set('countryCode')}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            >
              <option value="">— 국가를 선택하세요 —</option>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 한국일 때만 행정구역 선택 노출 */}
          {form.countryCode === 'KR' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                지역(행정구역) *
                {!geoDetecting && form.region && (
                  <span className="ml-2 text-xs text-slate-400 font-normal">IP 기반 자동 선택됨</span>
                )}
              </label>
              <select
                value={form.region}
                onChange={set('region')}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              >
                <option value="">— 지역을 선택하세요 —</option>
                {REGIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || geoDetecting}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white font-semibold py-2.5 rounded-lg transition-colors mt-2"
          >
            {loading ? '처리 중...' : '이메일로 가입하기'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="text-teal-600 hover:underline font-medium">로그인</Link>
        </p>
      </div>
    </div>
  );
}
