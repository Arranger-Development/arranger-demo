import { useEffect, useRef } from 'react';

export default function TemplateDialog({ children, titleId, onClose, className = '' }) {
  const panel = useRef(null);
  useEffect(() => {
    const before = document.activeElement;
    const first = panel.current?.querySelector('button:not(:disabled),input,select,[tabindex="0"]');
    (first ?? panel.current)?.focus();
    return () => { if (before?.isConnected) before.focus(); };
  }, []);
  return <div className="template-dialog-backdrop"><div ref={panel} className={`template-dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
    onKeyDown={e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const controls = [...panel.current.querySelectorAll('button:not(:disabled),input,select,[tabindex="0"]')];
        const first = controls[0], last = controls[controls.length-1];
        if (!first) { e.preventDefault(); return; }
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }}>{children}</div></div>;
}
