import {
  createElement,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ClipboardPaste,
  Copy,
  LayoutGrid,
  Redo2,
  Settings,
  SkipBack,
  Square,
  Undo2,
} from 'lucide-react';
import {
  ROOT_KEY,
  SCALE,
} from '../../domain/musicConstants.js';
import { getTutorialControlRole } from '../../tutorial/drumsTutorialRuntime.js';
import { MAX_PROJECT_BARS } from '../../domain/projectLength.js';
import { formatDisplayPosition } from '../transportPosition.js';
import { HardwareInputStatus } from './HardwareInputStatus.jsx';
import { BpmControl } from './BpmControl.jsx';
import { renderIcon } from './icons.js';

function BpmPopoverControl({
  bpm,
  className = '',
  locked = false,
  lockReason = '',
  onChange = () => {},
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      const clickedTrigger = containerRef.current?.contains(event.target);
      const clickedPopover = popoverRef.current?.contains(event.target);
      if (!clickedTrigger && !clickedPopover) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={['bpm-popover-control', className].filter(Boolean).join(' ')}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        className="bpm-status-trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`调整 BPM，当前 ${bpm}`}
        data-locked={locked ? 'true' : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="bpm-status-label">BPM</span>
        <span className="bpm-status-value mono">{bpm}</span>
      </button>
      {open ? createPortal(
        <div
          ref={popoverRef}
          className={`bpm-popover bpm-popover-portal ${className}-popover`}
          role="dialog"
          aria-label="BPM 设置"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="bpm-popover-head">
            <span>PROJECT TEMPO</span>
            <strong className="mono">{bpm}</strong>
          </div>
          <BpmControl
            disabled={locked}
            idPrefix={className || 'topbar-bpm'}
            value={bpm}
            onChange={onChange}
          />
          {locked ? (
            <p className="bpm-lock-reason" role="status">{lockReason}</p>
          ) : (
            <p className="bpm-popover-hint">播放时调整会立即改变速度，不会跳回开头。</p>
          )}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

function TopBar({
  activeTutorialTarget,
  bpm,
  bpmLocked = false,
  bpmLockReason = '',
  canCopyClip = false,
  canPasteClip = false,
  canRedo = false,
  canUndo = false,
  currentBar,
  currentStep,
  hardwareInput = null,
  isPlaying,
  onBackToStart,
  onBpmChange = () => {},
  onNewSong = () => {},
  onPlayToggle,
  onCopyClip = () => {},
  onExport = () => {},
  onPerformanceEnter,
  onPasteClip = () => {},
  onStop,
  onTutorialToggle,
  onRedo = () => {},
  onUndo = () => {},
  rootKey,
  scale,
  showTutorialToggle = false,
  tutorialCollapsed = false,
  tutorialToggleLabel: tutorialToggleLabelOverride = null,
  tutorialToggleActive = false,
  tutorialTargets,
}) {
  const active = activeTutorialTarget === 'top-bar';
  const tutorialToggleLabel = tutorialToggleLabelOverride
    ?? (tutorialCollapsed ? '展开教程' : '收起教程');
  const playTutorialRole = getTutorialControlRole(tutorialTargets, 'transport-play');
  const transportClassName = [
    'transport',
    playTutorialRole === 'target' ? 'tutorial-control-target tutorial-transport-target' : '',
  ].filter(Boolean).join(' ');
  const playClassName = [
    't-btn',
    'play',
    isPlaying ? 'active' : '',
  ].filter(Boolean).join(' ');
  const [
    displayBar = '—',
    displayBeat = '—',
    displayStep = '—',
  ] = formatDisplayPosition(currentBar, currentStep, MAX_PROJECT_BARS).split('.');

  return (
    <header
      className={`topbar${active ? ' tutorial-target-active' : ''}`}
      data-tutorial-target="top-bar"
    >
      <div className="brand">
        <div className="name">Project Arranger</div>
        <div className="project">v0.22</div>
      </div>

      <button className="btn-new" aria-label="New song" title="New song" type="button" onClick={onNewSong}>
        <span className="power-gem" aria-hidden="true" />
        <span className="btn-new-label">New</span>
      </button>

      <div className="topbar-left-controls">
        <div className="history-controls" role="toolbar" aria-label="History">
          <button
            className="t-btn undo"
            aria-label="向前一步"
            title="向前一步 (Ctrl+Z)"
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
          >
            {renderIcon(Undo2)}
          </button>
          <button
            className="t-btn redo"
            aria-label="向后一步"
            title="向后一步"
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
          >
            {renderIcon(Redo2)}
          </button>
        </div>

        <div className="clip-controls" role="toolbar" aria-label="Clip actions">
          <button
            className="t-btn copy-clip"
            aria-label="复制 clip"
            title="复制 clip (Cmd/Ctrl+C)"
            type="button"
            disabled={!canCopyClip}
            onClick={onCopyClip}
          >
            {renderIcon(Copy)}
          </button>
          <button
            className="t-btn paste-clip"
            aria-label="粘贴 clip"
            title="粘贴 clip (Cmd/Ctrl+V)"
            type="button"
            disabled={!canPasteClip}
            onClick={onPasteClip}
          >
            {renderIcon(ClipboardPaste)}
          </button>
        </div>

        <div className={transportClassName} role="toolbar" aria-label="Transport">
          <button
            className="t-btn"
            aria-label="Back to start"
            title="Back to start"
            type="button"
            onClick={onBackToStart}
          >
            {renderIcon(SkipBack)}
          </button>
          <button className="t-btn" aria-label="Stop" title="Stop" type="button" onClick={onStop}>
            {renderIcon(Square)}
          </button>
          <button
            className={playClassName}
            data-tutorial-anchor="transport"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            type="button"
            onClick={onPlayToggle}
          >
            <span className="play-glyph" aria-hidden="true" />
          </button>
        </div>

        <BpmPopoverControl
          bpm={bpm}
          className="mobile-bpm-control"
          locked={bpmLocked}
          lockReason={bpmLockReason}
          onChange={onBpmChange}
        />
      </div>

      <div className="topbar-center">
        <div className="hardware-status-display">
          <div className="stats" role="group" aria-label="Project info">
            <div className="stat">
              <div className="lbl">Position</div>
              <div className="val mono">
                {displayBar}
                <span className="sep">.</span>
                {displayBeat}
                <span className="sep">.</span>
                {displayStep}
              </div>
            </div>
            <div className="stat">
              <BpmPopoverControl
                bpm={bpm}
                className="desktop-bpm-control"
                locked={bpmLocked}
                lockReason={bpmLockReason}
                onChange={onBpmChange}
              />
            </div>
            <div className="stat">
              <div className="lbl">Key</div>
              <div className="val mono">{rootKey} maj</div>
            </div>
            <div className="stat">
              <div className="lbl">Scale</div>
              <div className="val mono">{scale === SCALE ? ROOT_KEY : scale}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="right-tools">
        {hardwareInput ? createElement(HardwareInputStatus, hardwareInput) : null}
        {onPerformanceEnter ? (
          <button className="key-switch performance-entry" type="button" onClick={onPerformanceEnter}>
            {renderIcon(LayoutGrid)}演奏模式
          </button>
        ) : null}
        {showTutorialToggle ? (
          <button
            className="key-switch tutorial-switch"
            data-active={tutorialToggleActive ? 'true' : undefined}
            type="button"
            aria-label={tutorialToggleLabel}
            title={tutorialToggleLabel}
            onClick={onTutorialToggle}
          >
            教程
          </button>
        ) : null}
        <div className="key-switch save-switch" title="All changes saved">
          <span className="dot" />
          Saved
        </div>
        <button
          className="hardware-export"
          type="button"
          aria-label="导出项目"
          title="导出音频、MIDI 或工程备份"
          onClick={onExport}
        >
          Export
        </button>
        <button className="icon-btn" aria-label="Settings" title="Settings">
          {renderIcon(Settings)}
        </button>
      </div>
    </header>
  );
}

// JSX component references are not marked as reads by this repository's lint parser.
void BpmControl;
void BpmPopoverControl;

export { TopBar };
