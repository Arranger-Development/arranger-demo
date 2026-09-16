import { Download, FileAudio, FileCode2, Music2, X } from 'lucide-react';
import { renderIcon } from './icons.js';

function ExportDialog({
  error = '',
  isExporting = false,
  onClose = () => {},
  onExportAudio = () => {},
  onExportStems = () => {},
  onExportMidi = () => {},
  onExportProject = () => {},
}) {
  return (
    <div className="export-dialog-overlay" role="presentation">
      <section
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        aria-describedby="export-dialog-copy"
      >
        <header className="export-dialog-heading">
          <div>
            <span className="export-dialog-kicker">RENDER &amp; SHARE</span>
            <h2 id="export-dialog-title">导出你的作品</h2>
          </div>
          <button
            className="export-dialog-close"
            type="button"
            aria-label="关闭导出面板"
            disabled={isExporting}
            onClick={onClose}
          >
            {renderIcon(X)}
          </button>
        </header>
        <p className="export-dialog-copy" id="export-dialog-copy">
          要在 Ableton Live 里直接听到声音，请使用音频分轨；它会按当前速度、音色、音量和静音状态离线渲染。
        </p>

        <div className="export-options">
          <button
            className="export-option export-option-primary"
            type="button"
            disabled={isExporting}
            onClick={onExportAudio}
          >
            <span className="export-option-icon">{renderIcon(FileAudio)}</span>
            <span className="export-option-copy">
              <strong>导出完整 WAV</strong>
              <small>{isExporting ? '正在离线渲染，请稍候…' : '44.1 kHz 立体声，可直接保存和分享'}</small>
            </span>
            <span className="export-option-action">{renderIcon(Download)}</span>
          </button>
          <button
            className="export-option export-option-live"
            type="button"
            disabled={isExporting}
            onClick={onExportStems}
          >
            <span className="export-option-icon">{renderIcon(FileAudio)}</span>
            <span className="export-option-copy">
              <strong>导出 Live 音频分轨</strong>
              <small>分别下载 Drums、Chord、Bass、Melody WAV；拖进 Live 即可直接播放并自动对齐</small>
            </span>
            <span className="export-option-action">{renderIcon(Download)}</span>
          </button>
          <button
            className="export-option"
            type="button"
            disabled={isExporting}
            onClick={onExportMidi}
          >
            <span className="export-option-icon">{renderIcon(Music2)}</span>
            <span className="export-option-copy">
              <strong>导出 Ableton MIDI</strong>
              <small>标准多轨 .mid；拖进 Live 后可继续编曲和换音色</small>
            </span>
            <span className="export-option-action">{renderIcon(Download)}</span>
          </button>
          <button
            className="export-option"
            type="button"
            disabled={isExporting}
            onClick={onExportProject}
          >
            <span className="export-option-icon">{renderIcon(FileCode2)}</span>
            <span className="export-option-copy">
              <strong>导出工程备份</strong>
              <small>Project Arranger .json，完整保留编曲、轨道和设置</small>
            </span>
            <span className="export-option-action">{renderIcon(Download)}</span>
          </button>
        </div>
        {error ? <p className="export-dialog-error" role="alert">{error}</p> : null}
        <p className="export-dialog-footnote">
          MIDI 只包含音符，不包含乐器；在 Live 中要为每条 MIDI 轨加载乐器或配置输出。`.als` 是 Ableton 的私有工程格式。
        </p>
      </section>
    </div>
  );
}

export { ExportDialog };
