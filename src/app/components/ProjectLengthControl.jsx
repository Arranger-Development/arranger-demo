import { useEffect, useRef, useState } from 'react';
import { getProjectExtensionError, MAX_PROJECT_BARS } from '../../domain/projectLength.js';
import './projectLengthControl.css';

export default function ProjectLengthControl({ totalBars, locked, lockReason, onExtend }) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const close = () => { dialogRef.current.close(); triggerRef.current?.focus(); };
  useEffect(() => {
    if (locked && dialogRef.current.open) dialogRef.current.close();
  }, [locked]);
  return <div className="project-length-control">
    <button type="button" className="key-switch project-length-trigger" ref={triggerRef}
      aria-label={`扩充小节数，当前 ${totalBars} 小节`} aria-haspopup="dialog"
      disabled={locked || totalBars >= MAX_PROJECT_BARS}
      title={locked ? lockReason : totalBars >= MAX_PROJECT_BARS ? '已达 256 小节' : '扩充工程小节数'}
      onClick={() => {
        setValue(String(totalBars)); setError(''); dialogRef.current.showModal(); inputRef.current?.focus();
      }}>小节数 <strong>{totalBars}</strong></button>
    <dialog ref={dialogRef} className="project-length-dialog" aria-labelledby="project-length-title"
      onKeyDown={(event) => event.stopPropagation()} onKeyUp={(event) => event.stopPropagation()}
      onCancel={(event) => { event.preventDefault(); close(); }}>
      <form onSubmit={(event) => {
        event.preventDefault();
        const message = getProjectExtensionError(value, totalBars);
        if (message) { setError(message); return; }
        if (locked) return;
        onExtend(Number(value)); close();
      }} noValidate>
        <h2 id="project-length-title">扩充小节数</h2>
        <p>当前 {totalBars} 小节 · 上限 {MAX_PROJECT_BARS} 小节</p>
        <label>目标总小节数<input ref={inputRef} aria-label="目标总小节数" type="number" step="1"
          min={totalBars} max={MAX_PROJECT_BARS} value={value} aria-invalid={Boolean(error)}
          aria-describedby="project-length-error" onChange={(event) => { setValue(event.target.value); setError(''); }} /></label>
        <p id="project-length-error" role="status">{error || '只追加空小节，原有内容保留。'}</p>
        <div className="project-length-actions"><button type="button" onClick={close}>取消</button>
          <button type="submit" disabled={locked}>扩充</button></div>
      </form>
    </dialog>
  </div>;
}
