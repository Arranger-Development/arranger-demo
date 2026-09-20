import { useLayoutEffect, useRef } from 'react';

export default function LiveExportDialog({ columns, counts, onCountsChange, error, length, onClose, onConfirm }) {
  const dialogRef = useRef(null);
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const returnFocus = document.activeElement;
    dialog.showModal();
    (dialog.querySelector('input') || dialog.querySelector('h2')).focus();
    return () => {
      dialog.close();
      if (returnFocus?.isConnected && returnFocus.getClientRects().length) returnFocus.focus({ preventScroll: true });
    };
  }, []);
  const handleKeyDown = (event) => {
    event.stopPropagation();
    if (event.key !== 'Tab') return;
    const controls = [...dialogRef.current.querySelectorAll('input:not(:disabled), button:not(:disabled)')];
    const index = controls.indexOf(document.activeElement);
    const next = event.shiftKey ? (index <= 0 ? controls.length - 1 : index - 1) : (index + 1) % controls.length;
    event.preventDefault();
    controls[next]?.focus();
  };
  return <dialog ref={dialogRef} className="pw-dialog" aria-labelledby="live-export-title"
    onKeyDown={handleKeyDown} onKeyUp={(event) => event.stopPropagation()}
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <h2 id="live-export-title" tabIndex={-1}>导出到创作模式</h2>
    <p>无限循环仅在本次导出中转换为有限次数。</p>
    {columns.filter((c) => c.snapshot && c.repeat === null).map((c) => <label key={c.id}>
      {c.name} <input type="number" min="1" aria-label={`${c.name}导出次数`} value={counts[c.id] ?? ''}
        onChange={(event) => onCountsChange({ ...counts, [c.id]: event.target.value })} />
    </label>)}
    <p role="status">{error || `共 ${length} 小节 · 上限 256 小节`}</p>
    <p>将替换当前创作编排，可在创作模式撤销。</p>
    <button type="button" onClick={onClose}>取消</button>
    <button type="button" className="pw-primary" disabled={Boolean(error) || length < 1 || length > 256}
      onClick={onConfirm}>展开并进入创作</button>
  </dialog>;
}
