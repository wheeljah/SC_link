import { useEffect } from 'react';

export default function CopyProtection() {
  useEffect(() => {
    // 우클릭 방지 — INPUT/TEXTAREA/링크는 허용
    const preventContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest?.('input') ||
        target.closest?.('textarea') ||
        target.closest?.('button') ||
        target.closest?.('a')
      ) return;
      e.preventDefault();
    };

    // 텍스트 선택 방지 (노드 선택 제외)
    const allowSelect = (el: HTMLElement) => {
      return (
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'BUTTON' ||
        el.tagName === 'A' ||
        el.closest?.('[contenteditable="true"]') ||
        el.closest?.('.allow-select')
      );
    };

    const preventSelect = (e: Event) => {
      const target = e.target as HTMLElement;
      if (allowSelect(target)) return;
      e.preventDefault();
    };

    // 모바일 long-press menu 방지 — touch 이벤트 레벨에서 INPUT/TEXTAREA 제외
    const preventTouchMenu = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest?.('input') ||
        target.closest?.('textarea') ||
        target.closest?.('button') ||
        target.closest?.('a') ||
        target.closest?.('.allow-select')
      ) return;
      // 모바일에서 커서 메뉴 숨기기
      const selection = window.getSelection();
      if (selection?.toString()) selection.removeAllRanges();
    };

    // 키보드 복사 단축키 방지
    const preventCopy = (e: KeyboardEvent) => {
      // F12 - 개발자도구
      if (e.key === 'F12') { e.preventDefault(); return; }
      // Ctrl+Shift+I - 개발자도구 (인스펙터)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') { e.preventDefault(); return; }
      // Ctrl+Shift+J - 콘솔
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') { e.preventDefault(); return; }
      // Ctrl+Shift+C - 요소 패널
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') { e.preventDefault(); return; }
      // Ctrl+U - 소스 보기
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); return; }
      // 인쇄 방지
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); return; }
    };

    // DevTools 감지 — 열릴 때 경고
    const checkDevTools = () => {
      const threshold = 160;
      setInterval(() => {
        const w = window.outerWidth - window.innerWidth > threshold;
        const h = window.outerHeight - window.innerHeight > threshold;
        if (w || h) console.warn('Developer tools detected. This is not allowed.');
      }, 1000);
    };

    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('selectstart', preventSelect);
    document.addEventListener('keydown', preventCopy);
    document.addEventListener('touchstart', preventTouchMenu, { passive: true });
    checkDevTools();

    // 드래그 방지 (이미지 등)
    document.querySelectorAll('img').forEach(img => {
      (img as HTMLImageElement).draggable = false;
    });
    const preventDrag = (e: Event) => e.preventDefault();
    document.addEventListener('dragstart', preventDrag);

    return () => {
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('selectstart', preventSelect);
      document.removeEventListener('keydown', preventCopy);
      document.removeEventListener('dragstart', preventDrag);
      document.removeEventListener('touchstart', preventTouchMenu);
    };
  }, []);

  return null;
}