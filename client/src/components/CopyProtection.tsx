import { useEffect } from 'react';

export default function CopyProtection() {
  useEffect(() => {
    // 우클릭 방지
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 텍스트 선택 방지 (노드 선택 제외)
    const preventSelect = (e: Event) => {
      const target = e.target as HTMLElement;
      // 버튼, 입력창, 링크는 선택 허용
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('button') ||
        target.closest('a')
      ) return;
      e.preventDefault();
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
    };
  }, []);

  return null;
}