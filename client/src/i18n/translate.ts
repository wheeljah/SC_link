// Runtime DOM translation engine (KO ↔ EN).
// 전체 화면의 한국어 UI 문구를 사전(dictionary) 기반으로 실시간 치환한다.
import { EN, RULES } from './dictionary';

const LS_KEY = 'sl_lang';
export type Lang = 'ko' | 'en';

export function getLang(): Lang {
  try { return (localStorage.getItem(LS_KEY) as Lang) || 'ko'; } catch { return 'ko'; }
}

export function setLang(l: Lang): void {
  try { localStorage.setItem(LS_KEY, l); } catch { /* ignore */ }
  // KO 복원/EN 적용을 가장 안전하게 처리하기 위해 새로고침
  window.location.reload();
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
  while ((n = tw.nextNode())) texts.push(n as Text);
  texts.forEach(translateTextNode);

  if (root instanceof Element) translateElement(root);
  const ew = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let e: Node | null;
  while ((e = ew.nextNode())) translateElement(e as Element);
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
