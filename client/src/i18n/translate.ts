// Runtime DOM translation engine (KO <-> EN).
// 전체 화면의 한국어 UI 문구를 사전(dictionary) 기반으로 실시간 치환한다.
import { EN, RULES } from './dictionary';

const LS_KEY      = 'sl_lang';
const LS_GEO_DONE = 'sl_geo_done'; // 최초 1회 IP 감지 완료 여부
export type Lang = 'ko' | 'en';

export function getLang(): Lang {
  try { return (localStorage.getItem(LS_KEY) as Lang) || 'ko'; } catch { return 'ko'; }
}

export function setLang(l: Lang): void {
  try {
    localStorage.setItem(LS_KEY, l);
    localStorage.setItem(LS_GEO_DONE, '1'); // 수동 변경 시 재감지 방지
  } catch { /* ignore */ }
  window.location.reload();
}

/** 최초 방문 시 IP 국가 감지 → 비한국이면 EN 기본값 설정 */
async function detectAndSetLang(): Promise<void> {
  try {
    const already = localStorage.getItem(LS_GEO_DONE);
    if (already) return; // 이미 감지했거나 수동 변경됨
    localStorage.setItem(LS_GEO_DONE, '1'); // 중복 요청 방지 (선점)

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch('https://ipapi.co/country/', { signal: ctrl.signal });
    clearTimeout(tid);
    const country = (await res.text()).trim(); // 'KR', 'US', ...
    if (country && country !== 'KR') {
      localStorage.setItem(LS_KEY, 'en');
      window.location.reload();
    }
  } catch (_e) { /* 감지 실패 시 기본값(ko) 유지 */ }
}

function translate(raw: string): string | null {
  const key = raw.trim();
  if (!key) return null;
  const exact = EN[key];
  if (exact !== undefined) return raw.replace(key, exact);
  for (const [re, rep] of RULES) {
    if (re.test(key)) {
      const out = key.replace(re, rep);
      if (out !== key) return raw.replace(key, out);
    }
  }
  return null;
}

function translateTextNode(node: Text): void {
  const v = node.nodeValue;
  if (!v) return;
  const t = translate(v);
  if (t !== null && t !== v) node.nodeValue = t;
}

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];

function translateElement(el: Element): void {
  for (const a of ATTRS) {
    const val = el.getAttribute(a);
    if (val) {
      const t = translate(val);
      if (t !== null && t !== val) el.setAttribute(a, t);
    }
  }
  if (el instanceof HTMLInputElement && (el.type === 'button' || el.type === 'submit') && el.value) {
    const t = translate(el.value);
    if (t !== null && t !== el.value) el.value = t;
  }
}

function walk(root: Node): void {
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  let n: Node | null;
  while ((n = tw.nextNode()) !== null) texts.push(n as Text);
  texts.forEach(translateTextNode);

  if (root instanceof Element) translateElement(root);
  const ew = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let e: Node | null;
  while ((e = ew.nextNode()) !== null) translateElement(e as Element);
}

let scheduled = false;
function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    walk(document.body);
  });
}

export function initI18n(): void {
  // 최초 방문 시 IP 감지 (비동기, 결과에 따라 reload)
  detectAndSetLang();

  if (getLang() !== 'en') return;
  const start = () => {
    walk(document.body);
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData' || m.addedNodes.length > 0 || m.type === 'attributes') {
          schedule();
          break;
        }
      }
    });
    obs.observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS,
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}
