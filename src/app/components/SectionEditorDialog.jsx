import { useLayoutEffect, useRef } from 'react';

export default function SectionEditorDialog({ bpm, onBpmChange, onClose, hardwareInput, onConnect, children }) {
  const dialogRef = useRef(null);
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    dialog.querySelector('h1')?.focus();
    return () => dialog.close();
  }, []);
  return <dialog ref={dialogRef} className="performance-mode jam-workspace section-editor-dialog"
    aria-labelledby="section-editor-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header className="performance-header">
      <div className="performance-title"><span className="performance-eyebrow">PROJECT ARRANGER / SECTION EDITOR</span><h1 id="section-editor-title" tabIndex={-1}>编辑／保存段落</h1></div>
      <label className="performance-tempo">BPM <input aria-label="段落编辑速度 BPM" type="number" min="40" max="240" value={bpm} onChange={(e) => onBpmChange(e.target.value)} /></label>
      <button type="button" className="performance-connect" onClick={onConnect}>{hardwareInput?.status === 'connected' ? 'Launchpad 已连接' : '连接 Launchpad'}</button>
      <button type="button" className="performance-back" aria-label="关闭段落编辑器" onClick={onClose}>×</button>
    </header>
    {children}
  </dialog>;
}
