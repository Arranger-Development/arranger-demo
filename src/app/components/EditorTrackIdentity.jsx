import { TRACK_ICONS, renderIcon } from './icons.js';

export function EditorTrackIdentity({ label, trackId }) {
  const Icon = TRACK_ICONS[trackId];

  return (
    <div className={['editor-track-identity', 'track-select'].join(' ')} data-type={trackId}>
      <span className="ic">
        {renderIcon(Icon)}
      </span>
      <span className="track-name">{label}</span>
    </div>
  );
}
