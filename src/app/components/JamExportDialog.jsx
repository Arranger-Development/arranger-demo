import { useLayoutEffect, useRef } from 'react';

export default function JamExportDialog({ entries, sections, onEntriesChange, onAdd, counts, onCountsChange, error, length, onClose, onConfirm }) {
  const dialogRef = useRef(null);
  useLayoutEffect(() => {
    const dialog = dialogRef.current; const returnFocus = document.activeElement;
    dialog.showModal(); dialog.querySelector('h2').focus();
    return () => { dialog.close(); if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }); };
  }, []);
  const move = (index, delta) => { const next = [...entries]; const [entry] = next.splice(index, 1); next.splice(index + delta, 0, entry); onEntriesChange(next); };
  return <dialog ref={dialogRef} className="jam-export-dialog" aria-labelledby="jam-export-title"
    onKeyDown={(event) => event.stopPropagation()} onKeyUp={(event) => event.stopPropagation()}
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <h2 id="jam-export-title" tabIndex={-1}>导出到创作模式</h2>
    <p>使用已保存的 Loop，未保存草稿不参与。这里的顺序和次数仅影响本次导出。</p>
    <label>添加 Loop <select aria-label="添加导出 Loop" value="" onChange={e => onAdd(e.target.value)}>
      <option value="" disabled>选择已保存的 Loop</option>{sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select></label>
    <ol>{entries.map((entry, index) => <li key={entry.id}>
      <strong>{entry.name}</strong><label>{entry.repeat === null ? '∞ → 本次次数' : '次数'}
        <input aria-label={`${entry.name} ${index + 1} 导出次数`} type="number" min="1" step="1" value={counts[entry.id] ?? (entry.repeat === null ? '' : entry.repeat)}
          onChange={e => { const value = e.target.value; if (entry.repeat === null) onCountsChange({ ...counts, [entry.id]: value }); else onEntriesChange(entries.map(row => row.id === entry.id ? { ...row, repeat: Number(value) } : row)); }} />
      </label><button disabled={index === 0} aria-label={`上移 ${entry.name}`} onClick={() => move(index, -1)}>↑</button>
      <button disabled={index === entries.length - 1} aria-label={`下移 ${entry.name}`} onClick={() => move(index, 1)}>↓</button>
      <button aria-label={`移除 ${entry.name}`} onClick={() => onEntriesChange(entries.filter(row => row.id !== entry.id))}>移除</button>
    </li>)}</ol>
    <p role="status">{error || `共 ${length} 小节 · 上限 256 小节`}</p><p>将替换当前创作编排，可在创作模式撤销。</p>
    <footer><button onClick={onClose}>取消</button><button disabled={Boolean(error) || length < 1 || length > 256} onClick={onConfirm}>展开并进入创作</button></footer>
  </dialog>;
}
