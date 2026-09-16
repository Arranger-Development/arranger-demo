import { Music } from 'lucide-react';
import { createElement } from 'react';
import { ClipNameInput } from './ClipNameInput.jsx';
import { TRACK_ICONS, renderIcon } from './icons.js';
import { TrackBarPager } from './TrackBarPager.jsx';

function TrackEditorPlaceholder({
  activeTrackId,
  activeTrackName,
  activeTrackType,
  canPageBars = false,
  clipName,
  onNextBar = () => {},
  onPreviousBar = () => {},
  onRenameClip,
}) {
  return (
    <section className="editor" data-screen-label="Track Editor">
      <header className="editor-head">
        <div className="editor-left">
          <div className="clip-chip">
            {renderIcon(TRACK_ICONS[activeTrackType] ?? Music)}
          </div>
          <div className="clip-title">
            <div className="crumb">{activeTrackName ?? 'Track'} · Phrase</div>
            {createElement(ClipNameInput, { clipName, onRenameClip })}
          </div>
        </div>
      </header>
      {createElement(TrackBarPager, {
        canPageBars,
        onNextBar,
        onPreviousBar,
        trackId: activeTrackId,
      }, (
        <div className="empty-editor">
          添加一个片段即可开始编辑
        </div>
      ))}
    </section>
  );
}

export { TrackEditorPlaceholder };
