import { Undo2, Redo2, SkipBack, Square, Play, Pause } from 'lucide-react';
void [Undo2, Redo2, SkipBack, Square, Play, Pause];

export default function LiveTransport({ columns, status, canUndo, canRedo, onUndo, onRedo, onPlay, onStop, onRewind }) {
  const running = status.mode === 'live';
  return <div className="pw-live-transport">
    <div role="toolbar" aria-label="Live 撤销与重做" className="pw-history-controls">
      <button type="button" className="t-btn" aria-label="撤销" title="撤销 (Cmd/Ctrl+Z)" disabled={!canUndo} onClick={onUndo}><Undo2 size={18} /></button>
      <button type="button" className="t-btn" aria-label="重做" title="重做 (Cmd/Ctrl+Shift+Z)" disabled={!canRedo} onClick={onRedo}><Redo2 size={18} /></button>
    </div>
    <div role="toolbar" aria-label="Live 播放控制" className="pw-transport-controls">
      <button type="button" className="t-btn" aria-label="回到开头" title="回到开头" onClick={onRewind}><SkipBack size={18} /></button>
      <button type="button" className="t-btn" aria-label="停止" title="停止 (Esc)" onClick={onStop}><Square size={16} /></button>
      <button type="button" className={`t-btn play${running ? ' active' : ''}`} aria-label={running ? '暂停' : '播放'} title={running ? '暂停 (Space)' : '播放 (Space)'} disabled={!columns.some(c => c.snapshot)} onClick={onPlay}>{running ? <Pause size={19} /> : <Play size={19} />}</button>
    </div>
  </div>;
}
