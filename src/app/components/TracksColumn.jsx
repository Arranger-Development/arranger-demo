import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  createElement,
  forwardRef,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  MAX_TRACK_VOLUME_DB,
  MIN_TRACK_VOLUME_DB,
} from '../trackVolumeViewModels.js';
import { getTrackVolumeFromClientX } from '../trackVolumeInteraction.js';
import { getTutorialControlRole } from '../../tutorial/drumsTutorialRuntime.js';
import { TRACK_ICONS, renderIcon } from './icons.js';

function TrackRow({
  active,
  fillEmptyClipsDisabled = false,
  onFillEmptyTrackClips = () => {},
  onSelect,
  onVolumeChange = () => {},
  onVolumeChangeEnd = () => {},
  onVolumeChangeStart = () => {},
  tutorialLocked = false,
  tutorialTargets,
  track,
}) {
  const volumeInputRef = useRef(null);
  const Icon = TRACK_ICONS[track.type ?? track.id];
  const classes = [
    'track',
    active ? 'selected' : '',
    track.hasClip ? 'has-phrase' : '',
  ].filter(Boolean).join(' ');
  const handleVolumeChange = (event) => {
    onVolumeChangeStart(track.id);
    onVolumeChange(track.id, Number(event.target.value));
    onVolumeChangeEnd(track.id);
  };
  const updateVolumeFromPointer = (event) => {
    onVolumeChange(
      track.id,
      getTrackVolumeFromClientX(event.clientX, event.currentTarget.getBoundingClientRect()),
    );
  };
  const handleVolumePointerDown = (event) => {
    onSelect(track.id);
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    volumeInputRef.current?.focus();
    onVolumeChangeStart(track.id);
    updateVolumeFromPointer(event);
  };
  const handleVolumePointerMove = (event) => {
    if (event.buttons !== 1) return;
    event.preventDefault();
    event.stopPropagation();
    updateVolumeFromPointer(event);
  };
  const handleVolumePointerUp = (event) => {
    event.stopPropagation();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    onVolumeChangeEnd(track.id);
  };
  const commitKeyboardVolumeChange = (volume) => {
    onVolumeChangeStart(track.id);
    onVolumeChange(track.id, volume);
    onVolumeChangeEnd(track.id);
  };
  const handleVolumeKeyDown = (event) => {
    const keyDeltas = {
      ArrowDown: -1,
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: 1,
      PageDown: -3,
      PageUp: 3,
    };

    if (event.key === 'Home') {
      event.preventDefault();
      commitKeyboardVolumeChange(MIN_TRACK_VOLUME_DB);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      commitKeyboardVolumeChange(MAX_TRACK_VOLUME_DB);
      return;
    }
    if (!Object.hasOwn(keyDeltas, event.key)) return;
    event.preventDefault();
    commitKeyboardVolumeChange(track.volume.value + keyDeltas[event.key]);
  };
  const stopVolumeEventPropagation = (event) => event.stopPropagation();
  const fillControlRole = getTutorialControlRole(tutorialTargets, `fill-empty-clips:${track.id}`);
  const fillButtonClassName = [
    'fill-empty-clips',
    fillControlRole === 'target' ? 'tutorial-control-target' : '',
  ].filter(Boolean).join(' ');
  const fillButtonDisabled = fillEmptyClipsDisabled || (tutorialLocked && fillControlRole !== 'target');

  return (
    <div
      className={classes}
      data-track-id={track.id}
      data-tutorial-anchor={`track-${track.id}`}
      data-type={track.type ?? track.id}
      onClick={() => onSelect(track.id)}
    >
      <span className="track-material-layer" aria-hidden="true" />
      <div className="track-main-row">
        <button
          className="track-select"
          type="button"
          aria-pressed={active}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(track.id);
          }}
        >
          <span className="ic">{renderIcon(Icon)}</span>
          <span className="track-name">{track.label}</span>
        </button>
        <button
          className={fillButtonClassName}
          type="button"
          aria-label={`填充 ${track.label} 整轨`}
          title="填充整轨"
          disabled={fillButtonDisabled}
          onClick={(event) => {
            event.stopPropagation();
            onFillEmptyTrackClips(track.id);
          }}
        >
          <span className="fill-gem" aria-hidden="true" />
          <span className="fill-empty-clips-icon" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span className="fill-empty-clips-label">填充整轨</span>
        </button>
      </div>
      <label
        className="vol"
        onClick={stopVolumeEventPropagation}
        onPointerDown={stopVolumeEventPropagation}
      >
        <span
          className="volume-control"
          onPointerDown={handleVolumePointerDown}
          onPointerMove={handleVolumePointerMove}
          onPointerUp={handleVolumePointerUp}
        >
          <span className="volume-knob" aria-hidden="true" style={{ left: `${track.volume.level}%` }} />
          <span className="bar" aria-hidden="true">
            <span className="fill" style={{ width: `${track.volume.level}%` }} />
            <span className="knob" style={{ left: `${track.volume.level}%` }} />
          </span>
          <input
            className="volume-slider"
            ref={volumeInputRef}
            type="range"
            min={MIN_TRACK_VOLUME_DB}
            max={MAX_TRACK_VOLUME_DB}
            step="1"
            value={track.volume.value}
            aria-label={`${track.label} volume`}
            aria-valuetext={track.volume.label}
            onChange={handleVolumeChange}
            onKeyDown={handleVolumeKeyDown}
          />
          <span className={`db mono${track.volume.value === MIN_TRACK_VOLUME_DB ? ' is-silent' : ''}`} aria-hidden="true">
            {track.volume.label}
          </span>
        </span>
      </label>
    </div>
  );
}

const TracksColumn = forwardRef(function TracksColumn(
  {
    activeTrackId,
    addTrackOptions = [],
    canRemoveTrack = () => false,
    fillEmptyClipsDisabled = false,
    onAddTrack = () => {},
    onFillEmptyTrackClips,
    onMoveTrack = () => {},
    onRemoveTrack = () => {},
    onRenameTrack = () => {},
    onTrackSelect,
    onVolumeChange,
    onVolumeChangeEnd,
    onVolumeChangeStart,
    tutorialLocked = false,
    tutorialTargets,
    tracks,
  },
  scrollRef,
) {
  const [trackManagerOpen, setTrackManagerOpen] = useState(false);
  const [pendingRemoveTrackId, setPendingRemoveTrackId] = useState(null);
  const draggedTrackIdRef = useRef(null);
  const pendingRemoveTrack = tracks.find((track) => track.id === pendingRemoveTrackId) ?? null;

  useEffect(() => {
    if (!trackManagerOpen && !pendingRemoveTrackId) return undefined;
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (pendingRemoveTrackId) setPendingRemoveTrackId(null);
      else setTrackManagerOpen(false);
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [pendingRemoveTrackId, trackManagerOpen]);

  const handleTrackNameCommit = (trackId, value) => {
    const nextName = value.trim();
    const previousName = tracks.find((track) => track.id === trackId)?.label ?? '';
    if (!nextName) return previousName;
    if (nextName !== previousName) onRenameTrack(trackId, nextName);
    return nextName;
  };

  return (
    <aside className="tracks-col" style={{ '--track-count': tracks.length }}>
      <div className="tracks-head">
        <div className="tracks-title">
          <span className="label">Tracks</span>
          <span className="count">{tracks.length}</span>
        </div>
        <button
          className="edit-btn"
          aria-label="编辑轨道"
          title="添加、排序和重命名轨道"
          type="button"
          onClick={() => setTrackManagerOpen(true)}
        >
          {renderIcon(SlidersHorizontal)}
        </button>
      </div>

      <div className="tracks-list" ref={scrollRef}>
        {tracks.map((track) => createElement(TrackRow, {
          active: track.id === activeTrackId,
          fillEmptyClipsDisabled,
          key: track.id,
          onFillEmptyTrackClips,
          onSelect: onTrackSelect,
          onVolumeChange,
          onVolumeChangeEnd,
          onVolumeChangeStart,
          tutorialLocked,
          tutorialTargets,
          track,
        }))}
      </div>

      {trackManagerOpen ? (
        <div className="track-manager-overlay" role="presentation">
          <section
            className="track-manager-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="track-manager-title"
          >
            <header className="track-manager-header">
              <div>
                <span className="track-manager-kicker mono">TRACK ROUTING</span>
                <h2 id="track-manager-title">编辑轨道</h2>
              </div>
              <button
                className="track-manager-close"
                type="button"
                aria-label="关闭轨道管理"
                onClick={() => setTrackManagerOpen(false)}
              >
                {renderIcon(X)}
              </button>
            </header>
            <div className="track-manager-body">
              <section className="track-manager-list-section" aria-label="当前轨道">
                <div className="track-manager-section-title">
                  <span>当前轨道</span>
                  <span className="mono">{tracks.length}</span>
                </div>
                <div className="track-manager-list">
                  {tracks.map((track, index) => {
                    const Icon = TRACK_ICONS[track.type];
                    const removable = canRemoveTrack(track.id);
                    return (
                      <div
                        className="track-manager-item"
                        data-type={track.type}
                        draggable
                        key={track.id}
                        onDragStart={() => {
                          draggedTrackIdRef.current = track.id;
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          const draggedTrackId = draggedTrackIdRef.current;
                          draggedTrackIdRef.current = null;
                          if (draggedTrackId && draggedTrackId !== track.id) {
                            onMoveTrack(draggedTrackId, index);
                          }
                        }}
                      >
                        <span className="track-manager-grip" aria-hidden="true">
                          {renderIcon(GripVertical)}
                        </span>
                        <span className="track-manager-type-icon">{renderIcon(Icon)}</span>
                        <label className="track-manager-name">
                          <span className="sr-only">{track.label} 名称</span>
                          <input
                            key={`${track.id}:${track.label}`}
                            type="text"
                            defaultValue={track.label}
                            maxLength={32}
                            onBlur={(event) => {
                              event.currentTarget.value = handleTrackNameCommit(
                                track.id,
                                event.currentTarget.value,
                              );
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') event.currentTarget.blur();
                            }}
                          />
                          <span className="mono">{track.type.toUpperCase()}</span>
                        </label>
                        <div className="track-manager-move-controls">
                          <button
                            type="button"
                            aria-label={`向上移动 ${track.label}`}
                            disabled={index === 0}
                            onClick={() => onMoveTrack(track.id, index - 1)}
                          >
                            {renderIcon(ChevronUp)}
                          </button>
                          <button
                            type="button"
                            aria-label={`向下移动 ${track.label}`}
                            disabled={index === tracks.length - 1}
                            onClick={() => onMoveTrack(track.id, index + 1)}
                          >
                            {renderIcon(ChevronDown)}
                          </button>
                        </div>
                        <button
                          className="track-manager-delete"
                          type="button"
                          aria-label={`删除 ${track.label}`}
                          title={removable ? '删除轨道' : '必须保留至少一条核心轨道'}
                          disabled={!removable}
                          onClick={() => setPendingRemoveTrackId(track.id)}
                        >
                          {renderIcon(Trash2)}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
              <section className="track-manager-add-section" aria-label="添加轨道">
                <div className="track-manager-section-title">
                  <span>添加轨道</span>
                  <span className="mono">7 TYPES</span>
                </div>
                <div className="track-manager-add-grid">
                  {addTrackOptions.map((track) => {
                    const trackType = track.type ?? track.id;
                    const Icon = TRACK_ICONS[trackType];
                    return (
                      <button
                        data-type={trackType}
                        key={track.id}
                        onClick={() => onAddTrack(trackType)}
                        type="button"
                      >
                        <span>{renderIcon(Icon)}</span>
                        <strong>{track.label}</strong>
                        <small>ADD CHANNEL</small>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </section>
          {pendingRemoveTrack ? (
            <div className="track-delete-confirm-overlay" role="presentation">
              <section
                className="track-delete-confirm"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="track-delete-confirm-title"
              >
                <span className="track-manager-kicker mono">REMOVE CHANNEL</span>
                <h3 id="track-delete-confirm-title">删除“{pendingRemoveTrack.label}”？</h3>
                <p>该轨道的 Clip、音符、音量和静音状态都会被删除。确认后可使用撤销恢复。</p>
                <div>
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setPendingRemoveTrackId(null)}
                  >
                    取消
                  </button>
                  <button
                    className="danger"
                    type="button"
                    onClick={() => {
                      onRemoveTrack(pendingRemoveTrack.id);
                      setPendingRemoveTrackId(null);
                    }}
                  >
                    删除轨道
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
});

export { TracksColumn };
