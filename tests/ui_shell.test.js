import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  CORE_TRACK_IDS,
  OPTIONAL_TRACK_IDS,
  TOTAL_BARS,
  TRACK_IDS,
} from '../src/domain/musicConstants.js';
import {
  BAR_NUMBERS,
  getTrackUiByIds,
  OPTIONAL_TRACK_UI,
  TRACK_UI,
} from '../src/app/uiShellData.js';

test('piano-roll row indicator uses one delegated coordinate without per-cell hover state', async () => {
  const rowIndicatorSource = await readFile(
    new URL('../src/app/usePianoRollRowIndicator.js', import.meta.url),
    'utf8',
  );

  assert.match(rowIndicatorSource, /useRef/);
  assert.match(rowIndicatorSource, /closest\?\.\('\[data-row\]'\)/);
  assert.match(rowIndicatorSource, /rowTarget\.offsetTop/);
  assert.match(rowIndicatorSource, /--piano-roll-hover-y/);
  assert.match(rowIndicatorSource, /handlePointerOver/);
  assert.match(rowIndicatorSource, /handlePointerLeave/);
  assert.match(rowIndicatorSource, /handleFocusCapture/);
  assert.match(rowIndicatorSource, /ResizeObserver/);
  assert.doesNotMatch(rowIndicatorSource, /querySelectorAll|classList|row-hovered|useState/);
});

test('topbar exposes independent undo redo controls and App wires history', async () => {
  const source = await readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8');
  const topBarSource = await readFile(new URL('../src/app/components/TopBar.jsx', import.meta.url), 'utf8');
  const undoControllerSource = await readFile(
    new URL('../src/app/useUndoHistoryController.js', import.meta.url),
    'utf8',
  );

  assert.match(topBarSource, /Undo2/);
  assert.match(topBarSource, /Copy/);
  assert.match(topBarSource, /ClipboardPaste/);
  assert.match(topBarSource, /Redo2/);
  assert.match(topBarSource, /canUndo\s*=\s*false/);
  assert.match(topBarSource, /canRedo\s*=\s*false/);
  assert.match(topBarSource, /canCopyClip\s*=\s*false/);
  assert.match(topBarSource, /canPasteClip\s*=\s*false/);
  assert.match(topBarSource, /onUndo/);
  assert.match(topBarSource, /onRedo/);
  assert.match(topBarSource, /onCopyClip/);
  assert.match(topBarSource, /onPasteClip/);
  assert.match(topBarSource, /className="history-controls"/);
  assert.match(topBarSource, /role="toolbar" aria-label="History"/);
  assert.match(topBarSource, /className="t-btn undo"/);
  assert.match(topBarSource, /className="t-btn redo"/);
  assert.match(topBarSource, /aria-label="向前一步"/);
  assert.match(topBarSource, /title="向前一步 \(Ctrl\+Z\)"/);
  assert.match(topBarSource, /aria-label="向后一步"/);
  assert.match(topBarSource, /title="向后一步"/);
  assert.match(topBarSource, /disabled=\{!canUndo\}/);
  assert.match(topBarSource, /disabled=\{!canRedo\}/);
  assert.match(topBarSource, /onClick=\{onUndo\}/);
  assert.match(topBarSource, /onClick=\{onRedo\}/);
  assert.match(topBarSource, /renderIcon\(Undo2\)/);
  assert.match(topBarSource, /renderIcon\(Redo2\)/);
  assert.match(topBarSource, /className="clip-controls"/);
  assert.match(topBarSource, /role="toolbar" aria-label="Clip actions"/);
  assert.match(topBarSource, /aria-label="复制 clip"/);
  assert.match(topBarSource, /title="复制 clip \(Cmd\/Ctrl\+C\)"/);
  assert.match(topBarSource, /disabled=\{!canCopyClip\}/);
  assert.match(topBarSource, /onClick=\{onCopyClip\}/);
  assert.match(topBarSource, /renderIcon\(Copy\)/);
  assert.match(topBarSource, /aria-label="粘贴 clip"/);
  assert.match(topBarSource, /title="粘贴 clip \(Cmd\/Ctrl\+V\)"/);
  assert.match(topBarSource, /disabled=\{!canPasteClip\}/);
  assert.match(topBarSource, /onClick=\{onPasteClip\}/);
  assert.match(topBarSource, /renderIcon\(ClipboardPaste\)/);
  assert.match(topBarSource, /className="history-controls"[\s\S]*className="t-btn undo"[\s\S]*className="t-btn redo"[\s\S]*<div className=\{transportClassName\} role="toolbar" aria-label="Transport">/);
  assert.match(topBarSource, /className="history-controls"[\s\S]*className="clip-controls"[\s\S]*<div className=\{transportClassName\} role="toolbar" aria-label="Transport">/);
  assert.doesNotMatch(topBarSource, /<div className=\{transportClassName\} role="toolbar" aria-label="Transport">[\s\S]*className="t-btn undo"[\s\S]*Back to start/);
  assert.doesNotMatch(topBarSource, /<div className=\{transportClassName\} role="toolbar" aria-label="Transport">[\s\S]*className="t-btn redo"[\s\S]*Back to start/);

  assert.match(source, /useUndoHistoryController\(\{[\s\S]*activeTutorialId,[\s\S]*appliedTutorialSetups,[\s\S]*clearTutorialAutoAdvanceTimer,[\s\S]*clearTutorialCountIn,[\s\S]*currentTutorialStepIndex,[\s\S]*dispatchAppCommand,/);
  assert.match(undoControllerSource, /createUndoSnapshot/);
  assert.match(undoControllerSource, /createUndoTransition/);
  assert.match(undoControllerSource, /createRedoTransition/);
  assert.match(undoControllerSource, /pushHistoryCheckpoint/);
  assert.match(undoControllerSource, /restoreUndoSnapshot/);
  assert.match(undoControllerSource, /const \[undoHistory,\s*setUndoHistory\] = useState\(\(\) => \[\]\);/);
  assert.match(undoControllerSource, /const \[redoHistory,\s*setRedoHistory\] = useState\(\(\) => \[\]\);/);
  assert.match(undoControllerSource, /canUndo:\s*undoHistory\.length > 0/);
  assert.match(undoControllerSource, /canRedo:\s*redoHistory\.length > 0/);
  assert.match(undoControllerSource, /const withUndoCheckpoint = useCallback/);
  assert.match(undoControllerSource, /const handleUndo = useCallback/);
  assert.match(undoControllerSource, /const handleRedo = useCallback/);
  assert.match(undoControllerSource, /volumeUndoSnapshotRef/);
  assert.match(source, /APP_COMMAND_TYPES\.APP_UNDO/);
  assert.match(source, /APP_COMMAND_TYPES\.APP_REDO/);
  assert.match(source, /APP_COMMAND_TYPES\.CLIP_COPY_SELECTED/);
  assert.match(source, /APP_COMMAND_TYPES\.CLIP_PASTE/);
  assert.match(source, /command\?\.type === APP_COMMAND_TYPES\.APP_UNDO[\s\S]*handleUndoWithMelodyStop\(\);[\s\S]*return;/);
  assert.match(source, /command\?\.type === APP_COMMAND_TYPES\.APP_REDO[\s\S]*handleRedoWithMelodyStop\(\);[\s\S]*return;/);
  assert.match(source, /command\?\.type === APP_COMMAND_TYPES\.CLIP_COPY_SELECTED[\s\S]*handleCopySelectedClip\(\);[\s\S]*return;/);
  assert.match(source, /command\?\.type === APP_COMMAND_TYPES\.CLIP_PASTE[\s\S]*handlePasteClipRequestWithMelodyStop\(\);[\s\S]*return;/);
  assert.match(undoControllerSource, /setRedoHistory\(\(\) => \[\]\)/);
  assert.match(source, /canRedo,\s*\n\s*canUndo,\s*\n\s*currentBar/);
  assert.match(source, /canCopyClip,/);
  assert.match(source, /canPasteClip,/);
  assert.match(source, /onCopyClip:\s*handleCopySelectedClip/);
  assert.match(source, /onPasteClip:\s*handlePasteClipRequestWithMelodyStop/);
  assert.match(source, /onRedo:\s*handleRedoWithMelodyStop/);
  assert.match(source, /onUndo:\s*handleUndoWithMelodyStop/);
  assert.match(source, /withUndoCheckpoint\(\(\) => \{[\s\S]*createClip\(trackId,\s*barIndex\)/);
  assert.match(source, /withUndoCheckpoint\(\(\) => \{[\s\S]*handleTutorialControlAction/);
  assert.match(source, /withUndoCheckpoint\(\(\) => \{[\s\S]*state\.setCell\('drums'/);
  assert.match(source, /withUndoCheckpoint\(\(\) => \{[\s\S]*setTutorialProgress/);
});

test('skeuomorphic workbench structure exposes hardware shell affordances', async () => {
  const appSource = await readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8');
  const topBarSource = await readFile(new URL('../src/app/components/TopBar.jsx', import.meta.url), 'utf8');
  const tracksColumnSource = await readFile(
    new URL('../src/app/components/TracksColumn.jsx', import.meta.url),
    'utf8',
  );
  const timelineSource = await readFile(new URL('../src/app/components/Timeline.jsx', import.meta.url), 'utf8');
  const bottomEditorSource = await readFile(
    new URL('../src/app/components/BottomEditor.jsx', import.meta.url),
    'utf8',
  );

  assert.match(topBarSource, /className="power-gem"/);
  assert.match(topBarSource, /<span className="btn-new-label">New<\/span>/);
  assert.match(topBarSource, /onNewSong = \(\) => \{\}/);
  assert.match(topBarSource, /<button\s+className="btn-new"\s+aria-label="New song"\s+title="New song"\s+type="button"\s+onClick=\{onNewSong\}>/);
  assert.doesNotMatch(topBarSource, /renderIcon\(Plus\)/);
  assert.doesNotMatch(topBarSource, />\s*New Song\s*</);
  assert.match(appSource, /const handleNewSong = useCallback\(\(\) => \{[\s\S]*const initialAppState = useMusicStore\.getInitialState\(\);[\s\S]*useMusicStore\.setState\(initialAppState, true\);/);
  assert.match(appSource, /onNewSong:\s*requestNewSong/);
  assert.match(topBarSource, /className="hardware-status-display"/);
  assert.match(topBarSource, /className="key-switch tutorial-switch"/);
  assert.match(topBarSource, /className="key-switch save-switch"/);
  assert.match(topBarSource, /className="hardware-export"/);

  assert.match(tracksColumnSource, /className="track-material-layer"/);
  assert.match(tracksColumnSource, /className="volume-knob"/);
  assert.match(tracksColumnSource, /className="fill-gem"/);

  assert.match(timelineSource, /className="timeline-bezel"/);
  assert.match(timelineSource, /className="grid-glass"/);

  assert.match(bottomEditorSource, /className="editor-hardware-shell"/);
});

test('new song flow asks before discarding the current arrangement', async () => {
  const appSource = await readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8');
  const topBarSource = await readFile(new URL('../src/app/components/TopBar.jsx', import.meta.url), 'utf8');

  assert.match(topBarSource, /<span className="btn-new-label">New<\/span>/);
  assert.match(appSource, /const \[isNewSongConfirmOpen,\s*setIsNewSongConfirmOpen\] = useState\(false\);/);
  assert.match(appSource, /const requestNewSong = useCallback\(\(\) => \{[\s\S]*setIsNewSongConfirmOpen\(true\);[\s\S]*\}, \[\]\);/);
  assert.match(appSource, /const cancelNewSong = useCallback\(\(\) => \{[\s\S]*setIsNewSongConfirmOpen\(false\);[\s\S]*\}, \[\]\);/);
  assert.match(appSource, /const confirmNewSong = useCallback\(\(\) => \{[\s\S]*setIsNewSongConfirmOpen\(false\);[\s\S]*handleNewSong\(\);[\s\S]*\}, \[handleNewSong\]\);/);
  assert.match(appSource, /onNewSong:\s*requestNewSong/);
  assert.doesNotMatch(appSource, /onNewSong:\s*handleNewSong/);
  assert.match(appSource, /isNewSongConfirmOpen \? \([\s\S]*className="new-song-confirm-overlay"[\s\S]*role="presentation"[\s\S]*className="new-song-confirm-dialog"[\s\S]*role="dialog"[\s\S]*aria-modal="true"[\s\S]*是否放弃当前进度创建新的乐章/);
  assert.match(appSource, /className="new-song-confirm-cancel"[\s\S]*onClick=\{cancelNewSong\}[\s\S]*取消/);
  assert.match(appSource, /className="new-song-confirm-apply"[\s\S]*onClick=\{confirmNewSong\}[\s\S]*创建新乐章/);
  assert.doesNotMatch(appSource, /window\.confirm/);
});

test('clip copy paste flow keeps an app clipboard and confirms destructive paste', async () => {
  const appSource = await readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8');
  const clipClipboardSource = await readFile(
    new URL('../src/app/useClipClipboardActions.js', import.meta.url),
    'utf8',
  );
  const pasteDestinationSource = await readFile(
    new URL('../src/app/clipPasteDestination.js', import.meta.url),
    'utf8',
  );

  assert.match(appSource, /useClipClipboardActions\(\{[\s\S]*clips,[\s\S]*onTimelineSelectionChange: setTimelineSelection,[\s\S]*selectedClipId,[\s\S]*timelineSelection,[\s\S]*withUndoCheckpoint,[\s\S]*\}\)/);
  assert.match(clipClipboardSource, /const \[clipClipboard,\s*setClipClipboard\] = useState\(null\);/);
  assert.match(clipClipboardSource, /const \[pasteDestination,\s*setPasteDestination\] = useState\(null\);/);
  assert.match(clipClipboardSource, /const \[pendingClipPaste,\s*setPendingClipPaste\] = useState\(null\);/);
  assert.match(clipClipboardSource, /const handleCopySelectedClip = useCallback\(\(\) => \{[\s\S]*createClipClipboardSnapshot\(selectedClipId\)[\s\S]*setClipClipboard\(snapshot\);[\s\S]*setPasteDestination\(null\);/);
  assert.match(clipClipboardSource, /createTimelineClipboardSnapshot\([\s\S]*timelineSelection,[\s\S]*\)/);
  assert.match(clipClipboardSource, /pasteTimelineClipboardSnapshot\([\s\S]*clipClipboard,[\s\S]*target\.targetBar/);
  assert.match(clipClipboardSource, /const handlePasteClipRequest = useCallback\(\(\) => \{[\s\S]*getCurrentClipPasteTarget\(\)[\s\S]*setPendingClipPaste/);
  assert.match(pasteDestinationSource, /targetHasContent:\s*hasTrackBarContent/);
  assert.match(pasteDestinationSource, /targetContentCount/);
  assert.doesNotMatch(clipClipboardSource, /if \(target\.targetClip \|\| target\.targetClips\?\.length\)/);
  assert.match(clipClipboardSource, /const confirmClipPaste = useCallback\(\(\) => \{[\s\S]*pasteClipToTarget\(pendingClipPaste\);[\s\S]*setPendingClipPaste\(null\);/);
  assert.match(clipClipboardSource, /const cancelClipPaste = useCallback\(\(\) => \{[\s\S]*setPendingClipPaste\(null\);[\s\S]*\}, \[\]\);/);
  assert.match(clipClipboardSource, /const clearClipClipboardState = useCallback\(\(\) => \{[\s\S]*setClipClipboard\(null\);[\s\S]*setPasteDestination\(null\);[\s\S]*setPendingClipPaste\(null\);/);
  assert.match(clipClipboardSource, /const clearClipPasteDestination = useCallback\(\(\) => \{[\s\S]*setPasteDestination\(null\);/);
  assert.match(clipClipboardSource, /const selectClipPasteDestination = useCallback\(\(trackId, bar\) => \{/);
  assert.match(clipClipboardSource, /const selectRulerPasteDestination = useCallback\(\(bar\) => \{/);
  assert.match(clipClipboardSource, /event\.key !== 'Escape'[\s\S]*clearClipPasteDestination\(\)/);
  assert.match(appSource, /const handleOpenClip = useCallback\(\(clipId\) => \{[\s\S]*selectClipPasteDestination\(clip\.trackId, clip\.bar\)/);
  assert.match(appSource, /const handleTransportSeek = useCallback\(\(bar, step\) => \{[\s\S]*selectRulerPasteDestination\(bar\)/);
  assert.match(appSource, /useKeyboardCommands\(\{[\s\S]*canPasteClip,/);
  assert.match(appSource, /clearClipClipboardState\(\);[\s\S]*useMusicStore\.setState\(initialAppState, true\);/);
  assert.match(appSource, /pendingClipPaste \? \([\s\S]*className="clip-paste-confirm-overlay"[\s\S]*role="presentation"[\s\S]*className="clip-paste-confirm-dialog"[\s\S]*role="dialog"[\s\S]*aria-modal="true"[\s\S]*确认覆盖这个 clip/);
  assert.match(appSource, /className="clip-paste-confirm-cancel"[\s\S]*onClick=\{cancelClipPaste\}[\s\S]*取消/);
  assert.match(appSource, /className="clip-paste-confirm-apply"[\s\S]*onClick=\{confirmClipPaste\}[\s\S]*覆盖粘贴/);
  assert.doesNotMatch(appSource, /window\.confirm/);
});

test('app shell renders the v0.22 arranger tracks and eight-bar timeline', async () => {
  const source = await readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8');
  const timelineSource = await readFile(new URL('../src/app/components/Timeline.jsx', import.meta.url), 'utf8');
  const tracksColumnSource = await readFile(
    new URL('../src/app/components/TracksColumn.jsx', import.meta.url),
    'utf8',
  );
  const editorResizeSource = await readFile(new URL('../src/app/useEditorResize.js', import.meta.url), 'utf8');
  const topBarSource = await readFile(new URL('../src/app/components/TopBar.jsx', import.meta.url), 'utf8');
  const uiDataSource = await readFile(new URL('../src/app/uiShellData.js', import.meta.url), 'utf8');

  assert.match(source, /aria-label="Project Arranger workspace"/);
  assert.match(topBarSource, /Project Arranger/);
  assert.match(topBarSource, /play-glyph/);
  assert.doesNotMatch(topBarSource, /import\s*\{[^}]*Play/);
  assert.match(source, /data-screen-label="Main"/);
  const chordEditorSource = await readFile(
    new URL('../src/app/components/ChordEditor.jsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /useEditorResize\(\{\s*activeTrackId,\s*selectedClipId,?\s*\}\)/);
  assert.match(editorResizeSource, /EDITOR_RESIZE_MIN_HEIGHT\s*=\s*180/);
  assert.match(editorResizeSource, /CHORD_EDITOR_RESIZE_MIN_HEIGHT\s*=\s*360/);
  assert.match(editorResizeSource, /CHORD_TEMPLATE_WORKSPACE_RESIZE_MIN_HEIGHT\s*=\s*420/);
  assert.match(editorResizeSource, /EDITOR_RESIZE_WORKSPACE_MIN_HEIGHT\s*=\s*180/);
  assert.match(editorResizeSource, /EDITOR_RESIZE_KEYBOARD_STEP\s*=\s*16/);
  assert.match(source, /editorHeightPx/);
  assert.match(editorResizeSource, /setEditorHeightPx/);
  assert.match(source, /handleEditorResizePointerDown/);
  assert.match(source, /handleEditorResizeKeyDown/);
  assert.match(editorResizeSource, /pointermove/);
  assert.match(editorResizeSource, /pointerup/);
  assert.match(source, /--app-editor-height/);
  assert.match(source, /className="editor-resizer"/);
  assert.match(source, /role="separator"/);
  assert.match(source, /aria-orientation="horizontal"/);
  assert.match(source, /aria-valuemin=\{editorResizeMinHeight\}/);
  assert.match(source, /aria-valuemax=\{editorResizeMaxHeight\}/);
  assert.match(source, /aria-valuenow=\{currentEditorResizeValue\}/);
  assert.match(source, /tabIndex=\{0\}/);
  assert.match(source, /onPointerDown=\{handleEditorResizePointerDown\}/);
  assert.match(source, /onKeyDown=\{handleEditorResizeKeyDown\}/);
  assert.match(source, /className="editor-resizer-grip"/);
  assert.match(source, /<\/main>[\s\S]*className="editor-resizer"[\s\S]*createElement\(BottomEditor/);
  assert.match(editorResizeSource, /case 'ArrowUp':/);
  assert.match(editorResizeSource, /case 'ArrowDown':/);
  assert.match(editorResizeSource, /case 'Home':/);
  assert.match(editorResizeSource, /case 'End':/);
  assert.match(editorResizeSource, /MutationObserver/);
  assert.match(chordEditorSource, /data-editor-resize-min-height=\{workspaceOpen/);
  assert.doesNotMatch(source, /localStorage/);
  assert.match(source, /drums/);
  assert.match(source, /DRUMS_TOGGLE/);
  assert.match(source, /createTimelineTracks/);
  assert.match(timelineSource, /Array\.from\(\{ length: totalBars \}/);
  assert.match(timelineSource, /const playheadLeft/);
  assert.match(timelineSource, /className=\{playheadLineClass\}/);
  assert.match(timelineSource, /className=\{playheadGridClass\}/);
  assert.match(timelineSource, /style=\{\{ left: playheadLeft \}\}/);
  assert.match(timelineSource, /onTransportSeek/);
  assert.match(timelineSource, /getTimelinePlayheadSeekPosition/);
  assert.match(timelineSource, /onClick=\{handleRulerClick\}/);
  assert.match(timelineSource, /onMouseDown=\{handleRulerMouseDown\}/);
  assert.match(timelineSource, /suppressRulerClickRef\.current = true/);
  assert.match(timelineSource, /if \(suppressRulerClickRef\.current\)/);
  assert.match(timelineSource, /rulerClickResetTimerRef\.current = window\.setTimeout/);
  assert.match(timelineSource, /shouldStartTimelineMarquee\(\{[\s\S]*button: event\.button,[\s\S]*shiftKey: event\.shiftKey,[\s\S]*tutorialLocked/);
  assert.match(timelineSource, /startMarqueeSession\(event, anchor, 'track'\)/);
  assert.match(timelineSource, /onMouseDownCapture=\{handleGridMouseDownCapture\}/);
  assert.match(timelineSource, /onClickCapture=\{handleGridClickCapture\}/);
  assert.match(timelineSource, /startMarqueeSession\(event,[\s\S]*trackIds\[0\],[\s\S]*'ruler'\)/);
  assert.match(timelineSource, /createRulerTimelineSelection\([\s\S]*marqueeSession\.anchor\.bar,[\s\S]*focus,[\s\S]*trackIds/);
  assert.match(timelineSource, /const suppressClipClickAfterDrag = useCallback\(\(\) => \{[\s\S]*setSuppressNextClick\(true\);[\s\S]*window\.setTimeout\(\(\) => \{[\s\S]*setSuppressNextClick\(false\)/);
  assert.match(timelineSource, /const suppressGridClickAfterMarquee = useCallback\(\(\) => \{[\s\S]*suppressGridClickRef\.current = true/);
  assert.match(timelineSource, /marqueeSession\.source === 'track'[\s\S]*suppressGridClickAfterMarquee\(\)/);
  assert.match(timelineSource, /marqueeSession\.source === 'ruler'[\s\S]*suppressRulerClickRef\.current = true/);
  assert.match(timelineSource, /handlePlayheadMouseDown/);
  assert.match(timelineSource, /const handlePlayheadMouseDown = \(event\) => \{[\s\S]*event\.stopPropagation\(\)/);
  assert.match(timelineSource, /playhead-hit/);
  assert.doesNotMatch(timelineSource, /className="timeline-footer-spacer"/);
  assert.match(source, /handleTransportSeek/);
  assert.match(source, /onTransportSeek:\s*handleTransportSeek/);
  assert.match(source, /clips/);
  assert.match(source, /getClipForTrackBar/);
  assert.match(source, /createClip\(trackId,\s*barIndex\)/);
  assert.match(source, /const seekTransportToBarStart = useCallback\(\(bar\) => \{[\s\S]*TRANSPORT_SEEK[\s\S]*step:\s*0/);
  assert.match(source, /const handleTrackSelect = useCallback\(\(trackId, barIndex\) => \{[\s\S]*const hasExplicitBar = Number\.isInteger\(barIndex\);[\s\S]*if \(hasExplicitBar\) seekTransportToBarStart\(targetBar\);/);
  assert.match(source, /const handleAddClip = useCallback\(\(trackId, barIndex\) => \{[\s\S]*if \(clip\) \{[\s\S]*selectClipPasteDestination\(clip\.trackId, clip\.bar\);[\s\S]*seekTransportToBarStart\(clip\.bar\);/);
  assert.match(source, /const handleOpenClip = useCallback\(\(clipId\) => \{[\s\S]*selectClip\(clipId\);[\s\S]*seekTransportToBarStart\(clip\.bar\);/);
  assert.match(source, /const handlePageTrackBar = useCallback\(\(direction\) => \{[\s\S]*state\.selectClip\(clip\.id\);[\s\S]*seekTransportToBarStart\(clip\.bar\);/);
  assert.match(source, /handleFillEmptyTrackClips/);
  assert.match(source, /createEmptyClipsForTrack\(trackId\)/);
  assert.match(source, /onFillEmptyTrackClips:\s*handleFillEmptyTrackClips/);
  assert.match(source, /trackOrder/);
  assert.match(source, /trackInstancesById/);
  assert.match(source, /getTrackUiByIds\(trackOrder, trackInstancesById\)/);
  assert.match(source, /handleAddTrack/);
  assert.match(source, /addTrackInstance\(trackType\)/);
  assert.match(source, /addTrackOptions:\s*availableAddTrackOptions/);
  assert.match(source, /onRenameTrack:\s*handleRenameTrack/);
  assert.match(source, /onMoveTrack:\s*handleMoveTrack/);
  assert.match(source, /onRemoveTrack:\s*handleRemoveTrack/);
  assert.match(source, /selectClip\(clipId\)/);
  assert.doesNotMatch(source, /track\.clipName/);
  assert.doesNotMatch(uiDataSource, /trackClips|clipName|selected:/);
  assert.match(tracksColumnSource, /onFillEmptyTrackClips/);
  assert.match(tracksColumnSource, /onFillEmptyTrackClips\(track\.id\)/);
  assert.match(tracksColumnSource, /填充整轨/);
  assert.match(tracksColumnSource, /aria-label=\{`填充 \$\{track\.label\} 整轨`\}/);
  assert.match(tracksColumnSource, /aria-label="编辑轨道"/);
  assert.match(tracksColumnSource, /className="track-manager-panel"/);
  assert.match(tracksColumnSource, /role="dialog"/);
  assert.match(tracksColumnSource, /onAddTrack\(trackType\)/);
  assert.match(tracksColumnSource, /onRenameTrack\(trackId, nextName\)/);
  assert.match(tracksColumnSource, /onMoveTrack\(draggedTrackId, index\)/);
  assert.match(tracksColumnSource, /onRemoveTrack\(pendingRemoveTrack\.id\)/);
  assert.doesNotMatch(tracksColumnSource, /\+8|铺满/);

  assert.deepEqual(TRACK_UI.map((track) => track.id), TRACK_IDS);
  assert.deepEqual(getTrackUiByIds(CORE_TRACK_IDS).map((track) => track.label), ['Drums', 'Chord', 'Bass', 'Melody']);
  assert.deepEqual(OPTIONAL_TRACK_UI.map((track) => track.id), OPTIONAL_TRACK_IDS);
  assert.deepEqual(OPTIONAL_TRACK_UI.map((track) => track.label), ['Pad', 'Vocal', 'Sampler']);
  assert.equal(TRACK_UI.every((track) => !Object.hasOwn(track, 'clipName')), true);
  assert.equal(BAR_NUMBERS.length, TOTAL_BARS);
  assert.equal(BAR_NUMBERS.at(0), 1);
  assert.equal(BAR_NUMBERS.at(-1), TOTAL_BARS);
});

test('app shell exposes the chord rhythm editor and unified template workspace', async () => {
  const source = await readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8');
  const bottomEditorSource = await readFile(
    new URL('../src/app/components/BottomEditor.jsx', import.meta.url),
    'utf8',
  );
  const chordEditorSource = await readFile(
    new URL('../src/app/components/ChordEditor.jsx', import.meta.url),
    'utf8',
  );
  const chordGrooveActionsSource = await readFile(
    new URL('../src/app/chordGrooveActions.js', import.meta.url),
    'utf8',
  );
  const chordStylePresetActionsSource = await readFile(
    new URL('../src/app/chordStylePresetActions.js', import.meta.url),
    'utf8',
  );
  const clipNameInputSource = await readFile(
    new URL('../src/app/components/ClipNameInput.jsx', import.meta.url),
    'utf8',
  );
  const drumSequencerSource = await readFile(
    new URL('../src/app/components/DrumSequencer.jsx', import.meta.url),
    'utf8',
  );
  const trackEditorPlaceholderSource = await readFile(
    new URL('../src/app/components/TrackEditorPlaceholder.jsx', import.meta.url),
    'utf8',
  );
  const chordApplyHandlerSource = source.slice(
    source.indexOf('const handleChordTemplateWorkspaceApply'),
    source.indexOf('const handleClearChordBar'),
  );
  const chordClearRequestSource = source.slice(
    source.indexOf('const handleClearChord = useCallback'),
    source.indexOf('const handleBassStepToggle'),
  );

  assert.match(chordEditorSource, /data-screen-label="Chord Editor"/);
  assert.match(chordEditorSource, /data-picker=\{workspaceOpen \? 'chord-workspace' : undefined\}/);
  assert.match(chordEditorSource, /ClipNameInput/);
  assert.match(drumSequencerSource, /ClipNameInput/);
  assert.match(trackEditorPlaceholderSource, /ClipNameInput/);
  assert.match(clipNameInputSource, /className="clip-name-input"/);
  assert.match(chordEditorSource, /选择和弦模板与律动/);
  assert.match(chordEditorSource, /当前小节主和弦/);
  assert.match(chordEditorSource, /下一小节主和弦/);
  assert.match(chordEditorSource, /本小节弹奏律动/);
  assert.match(chordEditorSource, /Array\.from\(\{ length: STEPS_PER_BAR \/ STEPS_PER_BEAT \}/);
  assert.match(chordEditorSource, /chord-rhythm-step-label/);
  assert.match(chordEditorSource, /aria-haspopup="dialog"/);
  assert.match(chordEditorSource, /aria-label=\{`\$\{isActive \? '关闭' : '开启'\}第 \$\{step \+ 1\} 步`\}/);
  assert.match(chordEditorSource, /handleRhythmStepToggle\(step\)/);
  assert.match(chordEditorSource, /getAppliedChordProgressionTemplateId/);
  assert.match(chordEditorSource, /getChordSelectedGrooveTemplateId/);
  assert.match(chordEditorSource, /getSourceChordLabel/);
  assert.match(chordEditorSource, /const hasPlayableChordContent = activeSteps\.size > 0/);
  assert.match(chordEditorSource, /\{hasPlayableChordContent \? \([\s\S]*className="chord-rhythm-progression-info"[\s\S]*\) : null\}/);
  assert.match(chordEditorSource, /className="chord-rhythm-summary-left"[\s\S]*className="chord-rhythm-readout current"/);
  assert.match(chordEditorSource, /className="chord-rhythm-sequencer-copy"/);
  assert.match(chordEditorSource, /\{hasPlayableChordContent \? \(currentChord \?\? '—'\) : '—'\}/);
  assert.match(chordEditorSource, /const hasPlayableNextChordContent = nextChordBar !== null[\s\S]*getChordRhythmSteps\(matrix, nextChordBar\)\.length > 0/);
  assert.match(chordEditorSource, /\{hasPlayableNextChordContent \? \(nextChord \?\? '—'\) : '—'\}/);
  assert.match(chordEditorSource, /getNextChordClipBar/);
  assert.match(chordEditorSource, /templates\.slice\(/);
  assert.match(chordEditorSource, /TEMPLATE_PAGE_SIZE = 3/);
  assert.match(chordEditorSource, /CHORD PROGRESSION/);
  assert.match(chordEditorSource, /CHORD GROOVE/);
  assert.match(chordEditorSource, /aria-pressed=\{pendingTemplateId === template\.id\}/);
  assert.match(chordEditorSource, /aria-pressed=\{pendingGrooveTemplateId === template\.id\}/);
  assert.match(chordEditorSource, /chord-template-card:\$\{template\.id\}/);
  assert.match(chordEditorSource, /chord-groove-card:\$\{template\.id\}/);
  assert.match(chordEditorSource, /onChordTemplateWorkspacePreview\(legacyTemplateMode/);
  assert.match(chordEditorSource, /progressionTemplateId: pendingTemplateId/);
  assert.match(chordEditorSource, /grooveTemplateId: pendingGrooveTemplateId/);
  assert.match(chordEditorSource, /styleChordTemplateId: pendingStyleChordTemplateId/);
  assert.match(chordEditorSource, /styleGrooveTemplateId: pendingStyleGrooveTemplateId/);
  assert.match(chordEditorSource, /getChordStyleChordTemplatesForGenre\(genreId\)/);
  assert.match(chordEditorSource, /getChordStyleGrooveTemplatesForGenre\(genreId\)/);
  assert.match(chordEditorSource, /data-chord-style-chord-template=\{template\.id\}/);
  assert.match(chordEditorSource, /data-chord-style-groove-template=\{template\.id\}/);
  assert.match(chordEditorSource, /visibleStyleGrooveTemplates\.map\(\(template\) =>/);
  assert.match(chordEditorSource, /grooveTemplatePage \+ 1/);
  assert.match(chordEditorSource, /styleGroovePageCount/);
  assert.match(chordEditorSource, /legacyTemplateMode \? \(/);
  assert.match(chordEditorSource, /onChordTemplateWorkspacePreviewStop\(\)/);
  assert.match(chordEditorSource, /previewRunRef/);
  assert.match(chordEditorSource, /aria-label=\{previewingTemplateId \? '停止试听' : '试听所选和弦与律动'\}/);
  assert.doesNotMatch(chordEditorSource, /chord-style-preset-preview/);
  assert.match(chordEditorSource, /renderIcon\(Square\)/);
  assert.match(chordEditorSource, /chord-rhythm-beat-group/);
  assert.match(chordEditorSource, /chord-template-mini-beat-group/);
  assert.match(chordEditorSource, /STEPS_PER_BAR \/ STEPS_PER_BEAT/);
  assert.match(chordEditorSource, /onChordTemplateWorkspaceApply\(legacyTemplateMode/);
  assert.match(chordEditorSource, /progressionTemplateId: pendingTemplateId/);
  assert.match(chordEditorSource, /grooveTemplateId: pendingGrooveTemplateId/);
  assert.match(chordEditorSource, /hasExistingChordClipContent\(matrix, clips\)/);
  assert.match(chordEditorSource, /onClick=\{handleApply\}/);
  assert.match(chordEditorSource, /是否覆盖已有内容的小节？/);
  assert.match(chordEditorSource, /覆盖并应用/);
  assert.match(chordEditorSource, /setConfirmApplyOpen\(false\)/);
  assert.doesNotMatch(chordEditorSource, /应用到本小节|应用到全局/);
  assert.match(chordEditorSource, /event\.key !== 'Escape'/);
  assert.match(chordEditorSource, /if \(confirmApplyOpen\)[\s\S]*setConfirmApplyOpen\(false\)[\s\S]*if \(harmonyPanel\)/);
  assert.match(chordEditorSource, /setWorkspaceOpen\(false\)/);
  assert.match(chordEditorSource, /icon-play\.svg/);
  assert.match(chordEditorSource, /icon-x\.svg/);
  assert.match(chordEditorSource, /清空本小节/);
  assert.match(chordEditorSource, /onClick=\{handleClearChord\}[\s\S]*清空整轨/);
  assert.match(chordEditorSource, /onClearChord\(\)/);
  assert.match(chordEditorSource, /ChordStepHarmonyPopover/);
  assert.match(chordEditorSource, /丰富和弦/);
  assert.match(chordEditorSource, /经过和弦/);
  assert.match(chordEditorSource, /PASSING_CHORD_STEP_INDEX/);
  assert.match(chordEditorSource, /chord-step-passing-availability/);
  assert.match(chordEditorSource, /canApplyPassing \? 'is-available' : 'is-restricted'/);
  assert.match(chordEditorSource, /canApplyPassing \? '第 15 步可用' : '仅第 15 步可用'/);
  assert.match(chordEditorSource, /aria-describedby=\{describedBy\}/);
  assert.match(
    chordEditorSource,
    /renderHarmonyOption\(option, 'passing', !canApplyPassing, optionIndex\)/,
  );
  assert.match(chordEditorSource, /chord-step-harmony-option-pad/);
  assert.match(chordEditorSource, /chord-step-harmony-option-preview/);
  assert.match(chordEditorSource, /onChordStepHarmonyPreview\(\{ chordName, mode \}\)/);
  assert.match(chordEditorSource, /aria-label=\{isPreviewing \? `停止试听 \$\{option\.name\}` : `试听 \$\{option\.name\}`\}/);
  assert.match(chordEditorSource, /harmonyPreviewRunRef/);
  assert.doesNotMatch(chordEditorSource, /More/);
  assert.doesNotMatch(chordEditorSource, /shouldConfirmChordTemplateApply|window\.confirm/);

  assert.match(chordGrooveActionsSource, /function applyChordTemplateWorkspaceToBar/);
  assert.match(chordGrooveActionsSource, /function applyChordTemplateWorkspaceToExistingClips/);
  assert.match(chordGrooveActionsSource, /function toggleChordRhythmStep/);
  assert.match(chordGrooveActionsSource, /function applyChordRhythmStepEnrichment/);
  assert.match(chordGrooveActionsSource, /function applyChordRhythmStepPassingChord/);
  assert.match(chordGrooveActionsSource, /function clearChordRhythmBar/);
  assert.match(chordGrooveActionsSource, /function createChordStepHarmonyPreviewEvents/);
  assert.match(chordGrooveActionsSource, /CUSTOM_CHORD_GROOVE_ID = 'custom-rhythm'/);
  assert.match(chordGrooveActionsSource, /CHORD_SOURCE_CELL_TYPE = 'chord-source'/);
  assert.match(chordStylePresetActionsSource, /function createChordStylePresetPreviewEvents/);
  assert.match(chordStylePresetActionsSource, /function applyChordStylePresetToExistingClips/);
  assert.match(chordStylePresetActionsSource, /function createChordStyleSelectionPreviewEvents/);
  assert.match(chordStylePresetActionsSource, /function applyChordStyleSelectionToExistingClips/);
  assert.match(chordStylePresetActionsSource, /function getAppliedChordStyleSelection/);
  assert.match(chordStylePresetActionsSource, /chordStyleChordTemplateId/);
  assert.match(chordStylePresetActionsSource, /chordStyleGrooveTemplateId/);
  assert.match(chordStylePresetActionsSource, /chordStylePresetId/);

  assert.match(source, /handleChordRhythmStepToggle/);
  assert.match(source, /handleChordStepHarmonyApply/);
  assert.match(source, /handleChordStepHarmonyPreview/);
  assert.match(source, /applyChordRhythmStepEnrichment/);
  assert.match(source, /applyChordRhythmStepPassingChord/);
  assert.match(source, /handleChordTemplateWorkspaceApply/);
  assert.doesNotMatch(chordApplyHandlerSource, /TRANSPORT_STOP/);
  assert.match(source, /handleChordTemplateWorkspacePreview/);
  assert.match(source, /handleChordTemplateWorkspacePreviewStop/);
  assert.match(source, /applyChordTemplateWorkspaceToExistingClips/);
  assert.match(source, /applyChordStylePresetToExistingClips/);
  assert.match(source, /applyChordStyleSelectionToExistingClips/);
  assert.doesNotMatch(source, /applyChordTemplateWorkspaceToBar/);
  assert.match(source, /toggleChordRhythmStep/);
  assert.match(source, /clearChordRhythmBar/);
  assert.match(chordClearRequestSource, /requestClearAction\(activeTrackId, 'track'\)/);
  assert.doesNotMatch(chordClearRequestSource, /clearTrack\(activeTrackId\)/);
  assert.match(source, /createChordTemplateWorkspacePreviewEvents/);
  assert.match(source, /createChordStylePresetPreviewEvents/);
  assert.match(source, /createChordStyleSelectionPreviewEvents/);
  assert.match(source, /createChordStepHarmonyPreviewEvents/);
  assert.match(source, /previewChordClipSequence/);
  assert.match(source, /APP_COMMAND_TYPES\.TRANSPORT_STOP/);
  assert.match(bottomEditorSource, /onChordRhythmStepToggle/);
  assert.match(bottomEditorSource, /onChordStepHarmonyApply/);
  assert.match(bottomEditorSource, /onChordStepHarmonyPreview/);
  assert.match(bottomEditorSource, /onChordStepHarmonyPreviewStop/);
  assert.match(bottomEditorSource, /onChordTemplateWorkspaceApply/);
  assert.match(bottomEditorSource, /onChordTemplateWorkspacePreview/);
  assert.match(bottomEditorSource, /onChordTemplateWorkspacePreviewStop/);
  assert.match(bottomEditorSource, /genreId/);
  assert.match(bottomEditorSource, /onClearChord/);
  assert.match(bottomEditorSource, /onClearChordBar/);
});

test('all destructive clear actions require one shared confirmation', async () => {
  const source = await readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const confirmHandlerSource = source.slice(
    source.indexOf('const confirmClearAction = useCallback'),
    source.indexOf('const handleTutorialNext'),
  );

  assert.match(source, /const \[pendingClearAction, setPendingClearAction\] = useState\(null\)/);
  assert.match(source, /const requestClearAction = useCallback\(\(trackId, scope, bar = null\) => \{[\s\S]*getTrackType\(state, trackId\)[\s\S]*trackName: state\.trackInstancesById\?\.\[trackId\]\?\.name/);
  assert.equal(source.match(/requestClearAction\(activeTrackId, 'bar', selectedBar\)/g)?.length, 4);
  assert.equal(source.match(/requestClearAction\(activeTrackId, 'track'\)/g)?.length, 4);
  assert.match(source, /event\.key !== 'Escape'/);
  assert.match(source, /cancelClearAction\(\)/);
  assert.match(source, /enabled: !pendingClearAction/);
  assert.match(source, /aria-label="关闭清空确认框"/);
  assert.match(source, /确认清空整条 \$\{pendingClearAction\.trackName\} 轨/);
  assert.match(source, /确认清空 \$\{pendingClearAction\.trackName\} 第 \$\{pendingClearAction\.bar \+ 1\} 小节/);
  assert.match(source, /onClick=\{cancelClearAction\}[\s\S]*取消/);
  assert.match(source, /onClick=\{confirmClearAction\}[\s\S]*确认清空/);
  assert.match(confirmHandlerSource, /withUndoCheckpoint\(\(\) => \{/);
  assert.match(confirmHandlerSource, /state\.clearTrack\(action\.trackId\)/);
  assert.match(confirmHandlerSource, /createTrackActionScope\(state, action\.trackId\)/);
  assert.match(confirmHandlerSource, /clearDrumsBar\(scope\.matrix, action\.bar\)/);
  assert.match(confirmHandlerSource, /clearChordRhythmBar\(scope\.matrix, action\.bar\)/);
  assert.match(confirmHandlerSource, /clearBassBar\(scope\.matrix, action\.bar\)/);
  assert.match(confirmHandlerSource, /clearMelodyBar\(scope\.matrix, action\.bar\)/);
  assert.match(css, /\.clear-confirm-heading\s*\{/);
  assert.match(css, /\.clear-confirm-close\s*\{/);
});

test('timeline add clip controls switch the persistent editor by track row', async () => {
  const source = await readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const bottomEditorSource = await readFile(
    new URL('../src/app/components/BottomEditor.jsx', import.meta.url),
    'utf8',
  );
  const tracksColumnSource = await readFile(
    new URL('../src/app/components/TracksColumn.jsx', import.meta.url),
    'utf8',
  );
  const drumSequencerSource = await readFile(
    new URL('../src/app/components/DrumSequencer.jsx', import.meta.url),
    'utf8',
  );
  const chordEditorSource = await readFile(
    new URL('../src/app/components/ChordEditor.jsx', import.meta.url),
    'utf8',
  );
  const bassEditorSource = await readFile(
    new URL('../src/app/components/BassEditor.jsx', import.meta.url),
    'utf8',
  );
  const melodyEditorSource = await readFile(
    new URL('../src/app/components/MelodyEditor.jsx', import.meta.url),
    'utf8',
  );
  const trackEditorPlaceholderSource = await readFile(
    new URL('../src/app/components/TrackEditorPlaceholder.jsx', import.meta.url),
    'utf8',
  );
  const trackBarPagerSource = await readFile(
    new URL('../src/app/components/TrackBarPager.jsx', import.meta.url),
    'utf8',
  );
  const timelineSource = await readFile(
    new URL('../src/app/components/Timeline.jsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /activeTrackId/);
  assert.match(source, /handleAddClip/);
  assert.match(source, /handleOpenClip/);
  assert.doesNotMatch(source, /onDrumsPreview/);
  assert.match(source, /syncTrackScrollContainers/);
  assert.match(source, /tracksScrollRef/);
  assert.match(source, /timelineScrollRef/);
  assert.match(source, /ref:\s*tracksScrollRef/);
  assert.match(source, /ref:\s*timelineScrollRef/);
  assert.match(source, /onAddClip/);
  assert.match(source, /onTrackSelect:\s*handleTrackSelect/);
  assert.match(timelineSource, /onAddClip\(track\.id,\s*bar\.bar\)/);
  assert.match(timelineSource, /onTrackSelect/);
  assert.match(timelineSource, /handleTrackRowClick/);
  assert.match(timelineSource, /target\.closest\('button'\)/);
  assert.match(timelineSource, /onClick=\{\(event\) => handleTrackRowClick\(event,\s*track\.id\)\}/);
  assert.match(source, /handleMoveClip/);
  assert.match(timelineSource, /onMouseDown/);
  assert.match(timelineSource, /mousemove/);
  assert.match(timelineSource, /mouseup/);
  assert.match(timelineSource, /onMoveClip/);
  assert.match(timelineSource, /dragFeedback/);
  assert.doesNotMatch(timelineSource, /Pencil/);
  assert.doesNotMatch(timelineSource, /clip-mini/);
  assert.doesNotMatch(timelineSource, /onPreview/);
  assert.doesNotMatch(timelineSource, /Preview drums/);
  assert.match(timelineSource, /sourceBar:\s*clip\.bar/);
  assert.match(timelineSource, /drop-move/);
  assert.match(timelineSource, /drop-swap/);
  assert.match(timelineSource, /clip-dragging/);
  assert.match(timelineSource, /clip\.hasContent/);
  assert.match(timelineSource, /bar\.canAddClip/);
  assert.match(source, /createClip\(trackId,\s*barIndex\)/);
  assert.match(source, /moveClipToBar\(clipId,\s*targetBar\)/);
  assert.match(source, /selectClip\(clipId\)/);
  assert.match(source, /volumes/);
  assert.match(source, /setTrackVolume\(trackId,\s*volume\)/);
  assert.match(source, /onVolumeChange:\s*handleTrackVolumeChange/);
  assert.match(source, /setVolumeSource/);
  assert.match(source, /const state = useMusicStore\.getState\(\);[\s\S]*mutedTracks: state\.mutedTracks,[\s\S]*volumes: state\.volumes/);
  assert.match(tracksColumnSource, /type="range"/);
  assert.match(tracksColumnSource, /aria-label=\{`\$\{track\.label\} volume`\}/);
  assert.match(tracksColumnSource, /className=\{classes\}[\s\S]*onClick=\{\(\) => onSelect\(track\.id\)\}/);
  assert.match(tracksColumnSource, /handleVolumePointerDown[\s\S]*onSelect\(track\.id\)/);
  assert.match(tracksColumnSource, /onVolumeChange\(track\.id/);
  assert.match(tracksColumnSource, /handleVolumePointerDown/);
  assert.match(tracksColumnSource, /getTrackVolumeFromClientX/);
  assert.match(timelineSource, /data-track-row=\{track\.id\}/);
  assert.match(timelineSource, /data-track-index=\{trackIndex\}/);
  assert.match(timelineSource, /data-bar-index=\{bar\.bar\}/);
  assert.match(drumSequencerSource, /data-screen-label="Drum Sequencer"/);
  assert.match(trackBarPagerSource, /ChevronLeft/);
  assert.match(trackBarPagerSource, /ChevronRight/);
  assert.match(trackBarPagerSource, /aria-label="切换到上一个 Clip"/);
  assert.match(trackBarPagerSource, /aria-label="切换到下一个 Clip"/);
  assert.match(trackBarPagerSource, /className="track-page-btn-label"/);
  assert.match(trackBarPagerSource, />上一个</);
  assert.match(trackBarPagerSource, />下一个</);
  assert.match(trackBarPagerSource, />CLIP</);
  assert.match(trackBarPagerSource, /disabled=\{!canPageBars\}/);
  assert.match(trackBarPagerSource, /track-editor-pager-shell/);
  assert.match(trackBarPagerSource, /track-page-btn previous/);
  assert.match(trackBarPagerSource, /track-page-btn next/);
  assert.match(trackBarPagerSource, /data-type=\{trackId\}/);
  assert.match(drumSequencerSource, /TrackBarPager/);
  assert.match(drumSequencerSource, /trackId:\s*'drums'/);
  assert.match(chordEditorSource, /TrackBarPager/);
  assert.match(chordEditorSource, /trackId = 'chord'/);
  assert.match(bassEditorSource, /TrackBarPager/);
  assert.match(bassEditorSource, /trackId = 'bass'/);
  assert.match(melodyEditorSource, /TrackBarPager/);
  assert.match(melodyEditorSource, /trackId = 'melody'/);
  assert.match(trackEditorPlaceholderSource, /TrackBarPager/);
  assert.match(trackEditorPlaceholderSource, /trackId:\s*activeTrackId/);
  assert.match(drumSequencerSource, /drum-step-groups/);
  assert.match(drumSequencerSource, /drum-step-group/);
  assert.match(drumSequencerSource, /DRUM SEQUENCER - BAR/);
  assert.doesNotMatch(drumSequencerSource, /drum-bar-indicator/);
  assert.doesNotMatch(drumSequencerSource, /\/ 8/);
  assert.doesNotMatch(css, /\.drum-bar-indicator\s*\{/);
  assert.match(drumSequencerSource, /drumTemplatePickerOpen/);
  assert.match(drumSequencerSource, /data-picker=\{drumTemplatePickerOpen \? 'drum-template' : undefined\}/);
  assert.match(drumSequencerSource, /选择律动模板/);
  assert.match(drumSequencerSource, /drum-template-picker/);
  assert.match(drumSequencerSource, /drum-template-card/);
  assert.match(drumSequencerSource, /DRUM_TEMPLATE_HIT_LABELS/);
  assert.match(drumSequencerSource, /getDrumTemplateHitLabel\(\s*template,\s*row\.id,\s*stepIndex,?\s*\)/);
  assert.match(drumSequencerSource, /drum-template-beat-markers/);
  assert.match(drumSequencerSource, /drum-template-hit-label/);
  assert.match(drumSequencerSource, /data-hit-label=\{hitLabel \?\? undefined\}/);
  assert.doesNotMatch(drumSequencerSource, /drum-template-(?:legend|row-icon)/);
  assert.match(drumSequencerSource, /getDrumTemplatesForGenre\(genreId\)/);
  assert.match(drumSequencerSource, /drumTemplates\.map\(\(template\) =>/);
  assert.match(drumSequencerSource, /handleTemplatePreview\(template\.id\)/);
  assert.match(drumSequencerSource, /停止试听/);
  assert.match(drumSequencerSource, /应用到本小节/);
  assert.match(drumSequencerSource, /应用到整轨/);
  assert.match(drumSequencerSource, /hasExistingDrumsClipContent\(matrix, clips\)/);
  assert.match(drumSequencerSource, /是否覆盖已有 Drums 内容？/);
  assert.match(drumSequencerSource, /onClick=\{applyAllTemplate\}[\s\S]*覆盖并应用/);
  assert.match(drumSequencerSource, /if \(!confirmApplyAllOpen\) return undefined;[\s\S]*event\.key !== 'Escape'/);
  assert.doesNotMatch(drumSequencerSource, />\s*生成本小节\s*</);
  assert.doesNotMatch(drumSequencerSource, />\s*生成全局\s*</);
  assert.match(drumSequencerSource, /清本小节/);
  assert.match(drumSequencerSource, /清整轨/);
  assert.doesNotMatch(drumSequencerSource, /为本小节生成基础律动|全局生成基础律动|清空本小节|清空整轨/);
  assert.doesNotMatch(drumSequencerSource, /清空 Drums/);
  assert.match(drumSequencerSource, /onClose/);
  assert.match(drumSequencerSource, /const handleClose = \(\) => \{[\s\S]*closeTemplatePicker\(\);[\s\S]*onClose\(\);/);
  assert.match(drumSequencerSource, /className="editor-close"[\s\S]*onClick=\{handleClose\}/);
  assert.match(source, /applyBasicDrumsBar/);
  assert.match(source, /getDrumsClipBarIndexes/);
  assert.match(source, /applyBasicDrumsAllBars/);
  assert.match(source, /applyBasicDrumsAllBars\(scope\.matrix,\s*drumsClipBars\)/);
  assert.match(source, /applyDrumsTemplateToBar\(scope\.matrix,\s*selectedBar,\s*templateId\)/);
  assert.match(source, /applyDrumsTemplateToBars\(scope\.matrix,\s*drumsClipBars,\s*templateId\)/);
  assert.match(source, /createDrumTemplatePreviewEvents\(templateId\)/);
  assert.match(source, /audioEngine\.previewDrumsPattern\(events/);
  assert.doesNotMatch(source, /createBasicDrumsBarWithoutKick/);
  assert.match(source, /clearDrumsBar/);
  assert.match(source, /getAdjacentTrackClipBar/);
  assert.match(source, /canPageTrackClipBars/);
  assert.doesNotMatch(source, /getAdjacentDrumsClipBar/);
  assert.doesNotMatch(source, /canPageDrumsClipBars/);
  assert.match(source, /handlePreviousBar/);
  assert.match(source, /handleNextBar/);
  assert.match(source, /handlePageTrackBar\('previous'\)/);
  assert.match(source, /handlePageTrackBar\('next'\)/);
  assert.match(source, /getAdjacentTrackClipBar\(\s*state\.clips,\s*state\.activeTrackId,\s*state\.selectedBar,\s*direction,\s*\)/);
  assert.match(
    bottomEditorSource,
    /activeTrackType === 'drums' && \(selectedClipId \|\| drumsWriting\)/,
  );
  assert.match(bottomEditorSource, /canPageBars/);
  assert.match(bottomEditorSource, /onPreviousBar/);
  assert.match(bottomEditorSource, /onNextBar/);
  assert.match(bottomEditorSource, /trackId:\s*activeTrackId/);
  assert.doesNotMatch(bottomEditorSource, /onPreviousDrumsBar/);
  assert.doesNotMatch(bottomEditorSource, /onNextDrumsBar/);
  assert.doesNotMatch(bottomEditorSource, /canPageDrumsBars/);
  assert.match(bottomEditorSource, /canPageBars/);
  assert.match(bottomEditorSource, /onNextBar/);
  assert.match(bottomEditorSource, /onPreviousBar/);
  assert.match(bottomEditorSource, /onClose:\s*onCloseEditor/);
  assert.match(bottomEditorSource, /onTemplatePreview:\s*onDrumTemplatePreview/);
  assert.match(bottomEditorSource, /onTemplatePreviewStop:\s*onDrumTemplatePreviewStop/);
  assert.match(bottomEditorSource, /activeTrackType === 'chord'/);
  assert.match(bottomEditorSource, /onChordRhythmStepToggle/);
  assert.match(bottomEditorSource, /onChordTemplateWorkspacePreview/);
  assert.match(bottomEditorSource, /onChordTemplateWorkspacePreviewStop/);
  assert.match(bottomEditorSource, /onChordTemplateWorkspaceApply/);
  assert.match(bottomEditorSource, /onClearChordBar/);
  assert.match(bottomEditorSource, /tutorialLocked/);
  assert.match(bottomEditorSource, /tutorialTargets/);
  assert.match(bottomEditorSource, /createElement\(ChordEditor,[\s\S]*tutorialLocked,[\s\S]*tutorialTargets/);
  assert.doesNotMatch(bottomEditorSource, /onChordPick|onPassingChordPick|shouldConfirmChordTemplateApply/);
});

test('track editors reuse the full track-select identity style in editor-left headers', async () => {
  const tracksColumnSource = await readFile(
    new URL('../src/app/components/TracksColumn.jsx', import.meta.url),
    'utf8',
  );
  const editorTrackIdentitySource = await readFile(
    new URL('../src/app/components/EditorTrackIdentity.jsx', import.meta.url),
    'utf8',
  );
  const editorFiles = [
    ['DrumSequencer.jsx', 'drums'],
    ['ChordEditor.jsx', 'chord'],
    ['BassEditor.jsx', 'bass'],
    ['MelodyEditor.jsx', 'melody'],
  ];

  assert.match(tracksColumnSource, /const Icon = TRACK_ICONS\[track\.type \?\? track\.id\];/);
  assert.match(tracksColumnSource, /className="track-select"[\s\S]*renderIcon\(Icon\)/);
  assert.match(editorTrackIdentitySource, /import\s*\{[^}]*TRACK_ICONS[^}]*renderIcon[^}]*\}\s*from '\.\/icons\.js';/s);
  assert.match(editorTrackIdentitySource, /className=\{[^}]*editor-track-identity[^}]*track-select/s);
  assert.match(editorTrackIdentitySource, /const Icon = TRACK_ICONS\[trackId\];/);
  assert.match(editorTrackIdentitySource, /<span className="ic">[\s\S]*renderIcon\(Icon\)/);
  assert.match(editorTrackIdentitySource, /<span className="track-name">\{label\}<\/span>/);

  for (const [fileName, trackId] of editorFiles) {
    const source = await readFile(
      new URL(`../src/app/components/${fileName}`, import.meta.url),
      'utf8',
    );

    assert.match(
      source,
      /import\s*\{\s*EditorTrackIdentity\s*\}\s*from '\.\/EditorTrackIdentity\.jsx';/,
    );
    assert.match(
      source,
      new RegExp(`createElement\\(EditorTrackIdentity, \\{ trackId: '${trackId}', label: trackName \\}\\)`),
    );
    assert.doesNotMatch(source, /className="clip-chip"[\s\S]*TRACK_ICONS\./);
  }

  const melodyEditorSource = await readFile(
    new URL('../src/app/components/MelodyEditor.jsx', import.meta.url),
    'utf8',
  );

  assert.match(melodyEditorSource, /className="ks-octave"/);
  assert.doesNotMatch(melodyEditorSource, /renderIcon\(Keyboard\)|className="ks-glyph"/);
});

test('bass and melody share the reusable PianoRoll component', async () => {
  const editorFiles = ['BassEditor.jsx', 'MelodyEditor.jsx'];

  for (const fileName of editorFiles) {
    const source = await readFile(
      new URL(`../src/app/components/${fileName}`, import.meta.url),
      'utf8',
    );

    assert.match(source, /import \{ PianoRoll \} from '\.\/PianoRoll\.jsx';/);
    assert.match(source, /createElement\(PianoRoll,/);
    assert.doesNotMatch(source, /notes\.flatMap|className="scale-notes-viewport"|pitch-step-cell/);
    assert.doesNotMatch(source, /MoreHorizontal|aria-label="More"/);
  }

  const pianoRollSource = await readFile(
    new URL('../src/app/components/PianoRoll.jsx', import.meta.url),
    'utf8',
  );
  const pitchScrollSource = await readFile(
    new URL('../src/app/usePitchScrollSync.js', import.meta.url),
    'utf8',
  );
  assert.match(pianoRollSource, /className=\{`piano-roll-grid \$\{trackId\}-grid`\}/);
  assert.match(pianoRollSource, /'pitch-step-cell'/);
  assert.match(pianoRollSource, /`\$\{trackId\}-cell`/);
  assert.match(pianoRollSource, /notes\.flatMap/);
  assert.match(pianoRollSource, /useLayoutEffect\(\(\) => \{/);
  assert.match(pianoRollSource, /nextActiveNoteIds\.forEach/);
  assert.match(pianoRollSource, /revealPitchRow\(noteIndexById\.get\(latestAddedNoteId\)\)/);
  assert.match(pianoRollSource, /highlightedNoteIds = EMPTY_ACTIVE_NOTE_IDS/);
  assert.match(pianoRollSource, /'--piano-roll-total-rows': notes\.length/);
  assert.match(pianoRollSource, /highlightedNoteIds\.has\(note\.note\)/);
  assert.match(pianoRollSource, /highlighted \? 'scale-tone' : ''/);
  assert.match(pianoRollSource, /addEventListener\('wheel',\s*handlePitchWheel,\s*\{ passive: false \}\)/);
  assert.match(pianoRollSource, /removeEventListener\('wheel',\s*handlePitchWheel\)/);
  assert.doesNotMatch(pianoRollSource, /onWheel=\{handlePitchWheel\}/);
  assert.match(pitchScrollSource, /if \(!hasPitchScrollRows\(noteCount, visibleRowCount\)\) return;/);

  const chordEditorSource = await readFile(
    new URL('../src/app/components/ChordEditor.jsx', import.meta.url),
    'utf8',
  );

  assert.match(chordEditorSource, /chord-rhythm-step-grid/);
  assert.match(chordEditorSource, /chord-rhythm-step/);
  assert.match(chordEditorSource, /STEPS_PER_BAR = 16/);
  assert.doesNotMatch(chordEditorSource, /PianoRoll|pitch-step-cell|chord-cell|CHORD_GRID_PITCHES/);
});

test('app exposes the melody editor and keeps melody as the internal track id', async () => {
  const source = await readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8');
  const bottomEditorSource = await readFile(
    new URL('../src/app/components/BottomEditor.jsx', import.meta.url),
    'utf8',
  );
  const melodyEditorSource = await readFile(
    new URL('../src/app/components/MelodyEditor.jsx', import.meta.url),
    'utf8',
  );
  const audioBridgeSource = await readFile(new URL('../src/app/audioUiBridge.js', import.meta.url), 'utf8');
  const melodyDataSource = await readFile(new URL('../src/data/melodyScales.js', import.meta.url), 'utf8');
  const melodyStyleDataSource = await readFile(new URL('../src/data/melodyStyleTemplates.js', import.meta.url), 'utf8');
  const uiDataSource = await readFile(new URL('../src/app/uiShellData.js', import.meta.url), 'utf8');
  const contextSliceSource = await readFile(
    new URL('../src/store/slices/contextSlice.js', import.meta.url),
    'utf8',
  );
  const pianoRollSource = await readFile(
    new URL('../src/app/components/PianoRoll.jsx', import.meta.url),
    'utf8',
  );
  const melodyRecordingSource = await readFile(
    new URL('../src/app/useMelodyRecordingController.js', import.meta.url),
    'utf8',
  );
  const audioEngineSource = await readFile(
    new URL('../src/audio/AudioEngine.js', import.meta.url),
    'utf8',
  );
  const clipsSliceSource = await readFile(
    new URL('../src/store/slices/clipsSlice.js', import.meta.url),
    'utf8',
  );
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(
    source,
    /const melodyEditorIsOpen = activeTrackType === 'melody' && Boolean\(selectedClipId\);/,
  );
  assert.match(uiDataSource, /melody:\s*'Melody'/);
  assert.match(contextSliceSource, /melodyScaleId:\s*'chinese'/);
  assert.match(contextSliceSource, /melodyRhythmTemplateId:\s*null/);
  assert.match(contextSliceSource, /melodyTimbreId:\s*'piano'/);
  assert.match(contextSliceSource, /setMelodyScaleId/);
  assert.match(contextSliceSource, /setMelodyStyleTemplate/);
  assert.match(contextSliceSource, /setMelodyTimbreId/);
  assert.match(bottomEditorSource, /MelodyEditor/);
  assert.match(bottomEditorSource, /activeTrackType === 'melody' && selectedClipId/);
  assert.match(bottomEditorSource, /onMelodyStepToggle/);
  assert.match(bottomEditorSource, /onMelodyPreview/);
  assert.match(bottomEditorSource, /onMelodyPreviewStop/);
  assert.match(bottomEditorSource, /onMelodyStyleTemplateApply/);
  assert.match(bottomEditorSource, /onMelodyTimbrePrepare/);
  assert.match(bottomEditorSource, /createElement\(MelodyEditor,[\s\S]*tutorialLocked,[\s\S]*tutorialTargets/);
  assert.match(melodyEditorSource, /data-screen-label="Melody Editor"/);
  assert.match(melodyEditorSource, /tutorialLocked = false/);
  assert.match(melodyEditorSource, /tutorialTargets/);
  assert.match(melodyEditorSource, /getTutorialControlRole/);
  assert.match(melodyEditorSource, /Melody · Phrase/);
  assert.match(melodyEditorSource, /MELODY EDITOR - BAR/);
  assert.match(melodyEditorSource, /keyboard-strip/);
  assert.match(melodyEditorSource, /QWERTY、网页与 Launchpad 音阶对应关系/);
  assert.match(melodyEditorSource, /Melody 风格模板/);
  assert.match(melodyEditorSource, /melody-style-button/);
  assert.match(melodyEditorSource, /melody-style-card:\$\{styleTemplate\.id\}/);
  assert.match(melodyEditorSource, /melody-style-apply-global/);
  assert.match(melodyEditorSource, /tutorial-control-target/);
  assert.match(melodyEditorSource, /data-tutorial-role=\{styleButtonRole/);
  assert.match(melodyEditorSource, /data-tutorial-role=\{styleCardRole/);
  assert.match(melodyEditorSource, /aria-disabled=\{styleCardDisabled\}/);
  assert.match(melodyEditorSource, /Melody Style Picker/);
  assert.match(melodyEditorSource, /className="scale-picker melody-scale-workspace"/);
  assert.match(melodyEditorSource, /className="melody-scale-workspace-panel"/);
  assert.match(melodyEditorSource, /className="melody-scale-workspace-head"/);
  assert.match(melodyEditorSource, /className="melody-scale-workspace-body"/);
  assert.match(melodyEditorSource, /className="melody-scale-workspace-label"/);
  assert.match(melodyEditorSource, /className="melody-scale-options"/);
  assert.match(melodyEditorSource, /className="melody-timbre-section"/);
  assert.match(melodyEditorSource, /className="melody-timbre-options"/);
  assert.match(melodyEditorSource, /'melody-timbre-card'/);
  assert.match(melodyEditorSource, /试听当前组合/);
  assert.match(melodyEditorSource, /加载并应用…/);
  assert.match(melodyEditorSource, /tutorialLocked \|\| timbreActionState\.endsWith\('loading'\)/);
  assert.match(melodyEditorSource, /className="melody-scale-workspace-icon-button close"/);
  assert.match(melodyEditorSource, /aria-labelledby="melodyStyleWorkspaceTitle"/);
  assert.match(melodyEditorSource, /aria-modal="true"/);
  assert.match(melodyEditorSource, /className="melody-scale-card-select"[\s\S]*aria-pressed=\{selected\}/);
  assert.doesNotMatch(melodyEditorSource, /className="tpl-head"|className="tpl-body"|className="tpl-list"/);
  assert.doesNotMatch(melodyEditorSource, /className="melody-beat-number-row"/);
  assert.doesNotMatch(melodyEditorSource, /className="beat-num mono"/);
  assert.doesNotMatch(melodyEditorSource, /const \[melodyRailOctave,\s*setMelodyRailOctave\]/);
  assert.doesNotMatch(melodyEditorSource, /clampMelodyRailOctave/);
  assert.doesNotMatch(melodyEditorSource, /DEFAULT_MELODY_RAIL_OCTAVE/);
  assert.match(melodyEditorSource, /createElement\(PianoRoll,\s*\{/);
  assert.match(melodyEditorSource, /activeNoteIds:\s*activePlayedNotes/);
  assert.match(melodyEditorSource, /autoRevealActiveNote:\s*true/);
  assert.doesNotMatch(melodyEditorSource, /flushSync|setPlayingKeys/);
  assert.match(melodyEditorSource, /getMelodyInputGrid/);
  assert.match(melodyEditorSource, /getVirtualMelodyInputId/);
  assert.match(melodyEditorSource, /setPointerCapture/);
  assert.match(melodyEditorSource, /initialTopNote:\s*'B4'/);
  assert.match(melodyEditorSource, /notes:\s*MELODY_NOTES/);
  assert.match(melodyEditorSource, /highlightedNoteIds:\s*activeScaleNoteIds/);
  assert.match(melodyEditorSource, /onCellToggle:\s*onMelodyStepToggle/);
  assert.match(audioEngineSource, /prepareMelodyTimbre\(timbreId,\s*trackId,\s*playbackMode\)/);
  assert.match(audioEngineSource, /activateMelodyTimbre\(timbreId\)/);
  assert.match(audioEngineSource, /setMelodyTimbreSource\(melodyTimbreSource\)/);
  assert.doesNotMatch(melodyEditorSource, /usePitchRowHover|getMelodyScaleRailNotes|setHoveredPitchRow/);
  assert.doesNotMatch(melodyEditorSource, /usePitchScrollSync/);
  assert.doesNotMatch(melodyEditorSource, /initializeToMiddleOctave/);
  assert.doesNotMatch(melodyEditorSource, /scalePitchViewportRef/);
  assert.doesNotMatch(melodyEditorSource, /setBeatCellsViewportRef/);
  assert.doesNotMatch(melodyEditorSource, /handlePitchViewportScroll/);
  assert.doesNotMatch(melodyEditorSource, /handlePitchWheel/);
  assert.doesNotMatch(melodyEditorSource, /scrollPitchByOctave/);
  assert.doesNotMatch(melodyEditorSource, /className="scale-notes-viewport"|className="beat-cells-viewport"|pitch-grid-head-spacer/);
  assert.match(melodyDataSource, /MELODY_STYLE_TEMPLATES/);
  assert.match(melodyStyleDataSource, /chinese:[\s\S]*\['C', 'D', 'E', 'G', 'A'\]/);
  assert.match(melodyStyleDataSource, /blues:[\s\S]*\['C', 'D', 'D#', 'E', 'G', 'A'\]/);
  assert.match(melodyEditorSource, /清空本小节/);
  assert.match(melodyEditorSource, /清空整轨/);
  assert.match(melodyEditorSource, /'btn-template',\s*'melody-record-button'/);
  assert.doesNotMatch(melodyEditorSource, /清空 Melody/);
  assert.doesNotMatch(melodyEditorSource, /Clear phrase/);
  assert.match(melodyEditorSource, /createElement\(TrackBarPager,\s*\{[\s\S]*className:\s*'melody-editor-pager-shell'/);
  assert.match(melodyEditorSource, /contentClassName:\s*\[[\s\S]*'melody-editor-scroll'[\s\S]*melodyInputVisible \? 'has-input-dock' : ''/);
  assert.match(melodyEditorSource, /melodyInputGrid\.map\(\(row\)/);
  assert.match(melodyEditorSource, /MELODY_PITCH_CLASSES/);
  assert.match(melodyEditorSource, /getMelodyScalePreviewNotes/);
  assert.match(melodyEditorSource, /isMelodyScalePitchClass/);
  assert.match(melodyEditorSource, /cell\.enabled \? 'scale-tone' : 'disabled'/);
  assert.match(melodyEditorSource, /isMelodyCellActive/);
  assert.doesNotMatch(melodyEditorSource, /pitch-step-cell|melody-cell|colIndex === 0 \? 'downbeat'/);
  assert.match(melodyEditorSource, /activePlayedNotes/);
  assert.match(melodyEditorSource, /onMelodyNoteOn\(\{/);
  assert.match(melodyEditorSource, /onMelodyNoteOff\(\{/);
  assert.doesNotMatch(melodyEditorSource, /Melody Rhythm Picker|Scale Picker/);
  assert.match(melodyEditorSource, /className="melody-style-actions"/);
  assert.match(melodyEditorSource, /function renderMelodyMiniGroove\(template\)/);
  assert.match(melodyEditorSource, /className="chord-template-mini-beat-group"/);
  assert.match(melodyEditorSource, /chord-template-mini-groove melody-style-mini-groove/);
  assert.doesNotMatch(melodyEditorSource, /melody-rhythm-mini-grid/);
  assert.match(
    melodyEditorSource,
    /activeRhythmTemplate\?\.steps\[melodyRecordingState\?\.barRecordedNotes\]/,
  );
  assert.match(melodyEditorSource, /activeHighlightedStep:\s*activeRhythmRecordingStep/);
  assert.match(pianoRollSource, /data-rhythm-template=/);
  assert.match(pianoRollSource, /rhythm-step-marker/);
  assert.match(pianoRollSource, /rhythm-column-next/);
  assert.match(css, /\.melody-style-actions\s*\{[^}]*justify-content:\s*flex-end;/s);
  assert.match(css, /\.melody-seq-body \.rhythm-step-marker\.highlighted/);
  assert.match(
    css,
    /\.melody-seq-body \.rhythm-step-marker\.highlighted::before\s*\{[^}]*var\(--melody-amethyst\)/s,
  );
  assert.match(css, /\.chord-template-groove-options > button\[aria-pressed="true"\]/);
  assert.match(css, /\.melody-style-mini-groove \.chord-template-mini-beat-group > span\.on/);
  assert.doesNotMatch(css, /\.melody-rhythm-mini-grid/);
  assert.match(css, /\.melody-cell\.rhythm-column::before/);
  assert.match(css, /@keyframes melody-rhythm-guide-pulse/);
  assert.match(css, /@keyframes melody-rhythm-target-pulse/);
  assert.match(melodyEditorSource, /覆盖并开始写入/);
  assert.match(melodyEditorSource, /每个小节会在收集完整一组音符后才原子覆盖/);
  assert.match(melodyEditorSource, /自由写入只会在播放到每个小节时覆盖/);
  assert.match(melodyEditorSource, /自由弹奏 · 不会写入；点击写入开始收集/);
  assert.doesNotMatch(melodyEditorSource, /自由试奏|auditionActive|onMelodyAuditionToggle/);
  assert.match(melodyEditorSource, /onClick=\{onMelodyWriteToggle\}/);
  assert.match(melodyEditorSource, /总音符/);
  assert.match(melodyEditorSource, /小节 \$\{writeBarProgress\}/);
  assert.match(melodyEditorSource, /开始旋律写入/);
  assert.match(melodyRecordingSource, /getMelodyWriteBarRange\(clip\.bar, getTotalBars\(state\) - 1, getTotalBars\(state\)\)/);
  assert.match(melodyRecordingSource, /const scopedMatrix = \{ \.\.\.state\.matrix, melody: state\.matrix\[pendingSession\.trackId\] \}/);
  assert.match(melodyRecordingSource, /hasMelodyNotesInRange\([\s\S]*scopedMatrix,[\s\S]*pendingSession\.startBar,[\s\S]*pendingSession\.endBar/);
  assert.match(melodyRecordingSource, /ensureMelodyClipsInRange\([\s\S]*pendingSession\.startBar,[\s\S]*pendingSession\.endBar,[\s\S]*pendingSession\.trackId/);
  assert.match(melodyRecordingSource, /audibleTrackIds:\s*\[pendingSession\.trackId\]/);
  assert.match(melodyRecordingSource, /maxPlaybackSteps:\s*pendingSession\.targetBars\.length \* STEPS_PER_BAR/);
  assert.match(melodyRecordingSource, /prepareFreeRecordingBar\(session, bar\)/);
  assert.match(melodyRecordingSource, /const completedBar = session\.currentBar;[\s\S]*replaceMelodyBarWithSequence\(/);
  assert.match(melodyRecordingSource, /session\.completedBars\.push\(completedBar\)/);
  assert.match(melodyRecordingSource, /barRecordedNotes/);
  assert.match(source, /handleMelodyRecordingTransportPosition\(bar, step\)/);
  assert.match(source, /onUndo: handleUndoWithMelodyStop/);
  assert.match(source, /onRedo: handleRedoWithMelodyStop/);
  assert.match(clipsSliceSource, /ensureMelodyClipsInRange/);
  assert.match(audioEngineSource, /this\.audibleTrackIds && !this\.audibleTrackIds\.has\(event\.trackId\)/);
  assert.match(audioEngineSource, /this\.playedSteps >= this\.maxPlaybackSteps/);
  assert.doesNotMatch(melodyEditorSource, /MELODY_RECORDING_PHASES\.PREVIEW|试听中 · 当前小节播放一次/);
  assert.doesNotMatch(melodyEditorSource, /renderIcon\(Circle\)|录制中|MELODY RECORD/);
  assert.match(melodyEditorSource, /melody-example-keys/);
  assert.match(melodyEditorSource, /data-tutorial-role=\{exampleKeysRole/);
  assert.doesNotMatch(melodyEditorSource, /recordMelodyKeyInput/);
  assert.doesNotMatch(audioBridgeSource, /recordMelodyKeyInput/);
  assert.match(source, /melodyScaleId/);
  assert.match(source, /handleMelodyStepToggle/);
  assert.match(source, /handleMelodyPreview/);
  assert.match(source, /handleMelodyStyleTemplateApply/);
  assert.match(source, /currentTutorialStep\?\.id === TUTORIAL_STEP_IDS\.MELODY_SELECT_SCALE/);
  assert.match(source, /control:\s*TUTORIAL_CONTROL_TARGETS\.MELODY_STYLE_APPLY_GLOBAL/);
  assert.match(source, /handleClearMelodyBar/);
  assert.match(source, /state\.clearTrack\(action\.trackId\)/);
  assert.match(source, /activeTrackType === 'melody' && Boolean\(selectedClipId\)/);
  assert.match(source, /audioEngine\.startAudio/);
});

test('app exposes the bass editor and existing-clip groove template workflow', async () => {
  const source = await readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8');
  const bottomEditorSource = await readFile(
    new URL('../src/app/components/BottomEditor.jsx', import.meta.url),
    'utf8',
  );
  const bassEditorSource = await readFile(
    new URL('../src/app/components/BassEditor.jsx', import.meta.url),
    'utf8',
  );
  const bassActionsSource = await readFile(new URL('../src/app/bassActions.js', import.meta.url), 'utf8');
  const bassNotesSource = await readFile(new URL('../src/data/bassNotes.js', import.meta.url), 'utf8');
  const bassApplyHandlerSource = source.slice(
    source.indexOf('const handleBassGrooveTemplateApply'),
    source.indexOf('const handleClearBassBar'),
  );

  assert.match(bottomEditorSource, /BassEditor/);
  assert.match(bottomEditorSource, /activeTrackType === 'bass' && selectedClipId/);
  assert.match(bottomEditorSource, /onBassStepToggle/);
  assert.match(bottomEditorSource, /onBassGrooveTemplatePreview/);
  assert.match(bottomEditorSource, /onBassGrooveTemplateApply/);
  assert.match(bottomEditorSource, /onClearBassBar/);
  assert.match(bottomEditorSource, /onClearBass/);
  assert.match(bottomEditorSource, /createElement\(BassEditor,[\s\S]*clips,[\s\S]*isPlaying/);
  assert.match(bottomEditorSource, /createElement\(BassEditor,[\s\S]*tutorialLocked,[\s\S]*tutorialTargets/);
  assert.match(bassEditorSource, /data-screen-label="Bass Editor"/);
  assert.match(bassEditorSource, /tutorialLocked = false/);
  assert.match(bassEditorSource, /tutorialTargets/);
  assert.match(bassEditorSource, /getTutorialControlRole/);
  assert.match(bassEditorSource, /Bass · Phrase/);
  assert.match(bassEditorSource, /BASS EDITOR - BAR/);
  assert.match(bassEditorSource, /createElement\(PianoRoll,\s*\{/);
  assert.match(bassEditorSource, /initialTopNote:\s*'D1'/);
  assert.match(bassEditorSource, /notes:\s*BASS_NOTES/);
  assert.match(bassEditorSource, /onCellToggle:\s*onBassStepToggle/);
  assert.match(bassEditorSource, /onNotePreview:\s*onBassPreview/);
  assert.match(bassEditorSource, /onPitchInteraction:\s*closeBassPicker/);
  assert.doesNotMatch(bassEditorSource, /BASS_NOTES\.(?:flatMap|map)|usePitchRowHover|usePitchScrollSync/);
  assert.doesNotMatch(bassEditorSource, /scalePitchViewportRef|setBeatCellsViewportRef|pitch-step-cell|bass-cell/);
  assert.doesNotMatch(bassEditorSource, /className="beat-number-row bass-beat-number-row"/);
  assert.doesNotMatch(bassEditorSource, /className="beat-num mono"/);
  assert.match(bassEditorSource, /BASS_GROOVE_TEMPLATES/);
  assert.match(bassEditorSource, /选择Bass弹奏律动模板/);
  assert.match(bassEditorSource, /bass-groove-button/);
  assert.match(bassEditorSource, /bass-groove-card:\$\{template\.id\}/);
  assert.match(bassEditorSource, /tutorial-control-target/);
  assert.match(bassEditorSource, /function isTutorialControlAllowed\(role\)\s*\{\s*return role === 'target' \|\| role === 'allowed';\s*\}/);
  assert.match(bassEditorSource, /grooveButtonRole === 'target' \? 'tutorial-control-target' : ''/);
  assert.match(bassEditorSource, /disabled=\{tutorialLocked && !isTutorialControlAllowed\(grooveButtonRole\)\}/);
  assert.match(bassEditorSource, /const templateCardDisabled = tutorialLocked && !isTutorialControlAllowed\(templateCardRole\);/);
  assert.match(bassEditorSource, /templateCardRole === 'target' \? 'tutorial-control-target' : ''/);
  assert.match(bassEditorSource, /data-tutorial-role=\{grooveButtonRole/);
  assert.match(bassEditorSource, /data-tutorial-role=\{templateCardRole/);
  assert.match(bassEditorSource, /aria-disabled=\{templateCardDisabled\}/);
  assert.match(bassEditorSource, /Bass Groove Template Picker/);
  assert.match(bassEditorSource, /getBassGroovePreviewSteps/);
  assert.match(bassEditorSource, /const previewHitStepSet = new Set\(getBassGroovePreviewSteps\(template\)\);/);
  assert.match(bassEditorSource, /className="chord-template-workspace bass-template-workspace"/);
  assert.match(bassEditorSource, /className="chord-template-workspace-panel bass-template-workspace-panel"/);
  assert.match(bassEditorSource, /className="chord-template-workspace-body bass-template-workspace-body"/);
  assert.match(bassEditorSource, /className="bass-template-groove-options"/);
  assert.match(bassEditorSource, /className="chord-template-mini-beat-group"/);
  assert.match(bassEditorSource, /previewHitStepSet\.has\(step\) \? 'on' : ''/);
  assert.match(bassEditorSource, /aria-labelledby="bassTemplateWorkspaceTitle"/);
  assert.match(bassEditorSource, /aria-modal="true"/);
  assert.match(bassEditorSource, /aria-pressed=\{selectedGrooveTemplateId === template\.id\}/);
  assert.match(bassEditorSource, /className="bass-template-card-select"/);
  assert.match(bassEditorSource, /className="chord-template-workspace-icon-button preview bass-template-card-preview"/);
  assert.match(bassEditorSource, /icon-play\.svg/);
  assert.match(bassEditorSource, /icon-x\.svg/);
  assert.match(bassEditorSource, /onBassGrooveTemplatePreview\(template\.id\)/);
  assert.match(bassEditorSource, /onBassGrooveTemplateApply\(templateId\)/);
  assert.match(bassEditorSource, /onClick=\{\(\) => handleGrooveTemplateApply\(template\.id\)\}/);
  assert.match(bassEditorSource, /if \(hasExistingBassClipContent\(matrix, clips\)\)/);
  assert.doesNotMatch(bassEditorSource, /isPlaying && hasExistingBassClipContent/);
  assert.match(bassEditorSource, /setSelectedGrooveTemplateId\(templateId\)[\s\S]*setConfirmApplyOpen\(true\)/);
  assert.match(bassEditorSource, /是否覆盖已有 Bass 内容？/);
  assert.match(bassEditorSource, /当前播放不会停止/);
  assert.match(bassEditorSource, /onClick=\{\(\) => setConfirmApplyOpen\(false\)\}[\s\S]*取消/);
  assert.match(bassEditorSource, /onClick=\{applySelectedGrooveTemplate\}[\s\S]*覆盖并应用/);
  assert.match(bassEditorSource, /if \(confirmApplyOpen\)[\s\S]*setConfirmApplyOpen\(false\)[\s\S]*closeBassPicker\(\)/);
  assert.match(bassEditorSource, /清空本小节/);
  assert.match(bassEditorSource, /清空整轨/);
  assert.doesNotMatch(bassEditorSource, /清空 Bass/);
  assert.match(bassActionsSource, /bass-8th-basic/);
  assert.match(bassActionsSource, /bass-8th-swing/);
  assert.match(bassActionsSource, /bass-16th-swing/);
  assert.match(bassActionsSource, /applyBassGrooveTemplateToBar/);
  assert.match(bassActionsSource, /applyBassGrooveTemplateToExistingClips/);
  assert.match(bassActionsSource, /function hasExistingBassClipContent\(matrix, clips\)/);
  assert.match(bassActionsSource, /createBassPreviewEvents/);
  assert.match(bassNotesSource, /BASS_NOTE_IDS/);
  assert.match(bassNotesSource, /createPianoRollNotes\(\{ lowestOctave: 0 \}\)/);
  assert.doesNotMatch(bassNotesSource, /CHORD_GRID_PITCHES/);
  assert.match(source, /handleBassStepToggle/);
  assert.match(source, /handleBassGrooveTemplatePreview/);
  assert.match(source, /createBassPreviewEvents\(scope\.matrix,\s*selectedBar,\s*templateId\)/);
  assert.match(source, /handleBassGrooveTemplateApply/);
  assert.doesNotMatch(bassApplyHandlerSource, /TRANSPORT_STOP/);
  assert.match(source, /currentTutorialStep\?\.id === TUTORIAL_STEP_IDS\.BASS_SELECT_GROOVE_TEMPLATE/);
  assert.match(source, /control:\s*`bass-groove-card:\$\{templateId\}`/);
  assert.match(source, /applyTutorialActionProgress\(tutorialAction\)/);
  assert.match(source, /applyBassGrooveTemplateToExistingClips\(\s*scope\.matrix,\s*scope\.clips,\s*templateId/);
  assert.match(source, /state\.setTrackMatrix\(scope\.trackId,\s*nextMatrix\.bass\)/);
  assert.doesNotMatch(source, /nextMatrix\.bass\[clip\.bar\]\.forEach\(\(cell,\s*step\) => \{[\s\S]*state\.setCell\('bass',\s*clip\.bar,\s*step,\s*cell\);/);
  assert.match(source, /handleClearBassBar/);
  assert.match(source, /requestClearAction\(activeTrackId, 'track'\)/);
  assert.match(source, /triggerBassNote/);
  assert.match(source, /previewBassPattern/);
});

test('bass and melody piano-roll removals stay silent', async () => {
  const source = await readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8');

  assert.match(source, /const handleBassStepToggle = useCallback\(\(step, note\) => \{[\s\S]*getBassCellToggleResult\([\s\S]*if \(auditionNote\) \{[\s\S]*triggerBassNote\([\s\S]*auditionNote,[\s\S]*'16n'/);
  assert.match(source, /const handleMelodyStepToggle = useCallback\(\(step, note\) => \{[\s\S]*getMelodyCellToggleResult\([\s\S]*if \(auditionNote\) \{[\s\S]*triggerMelodyInputOneShot\(auditionNote,/);
});

test('app keeps the editor focused on the playback bar while transport is playing', async () => {
  const source = await readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8');

  assert.match(source, /syncEditorToPlaybackBar/);
  assert.match(source, /syncEditorToPlaybackBar\(useMusicStore\.getState\(\),\s*currentBar\)/);
  assert.match(source, /\[\s*activeTrackId,\s*currentBar,\s*isPlaying,\s*selectedBar\s*\]/);
});

test('app mounts the drums tutorial right sidebar', async () => {
  const source = await readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8');
  const tutorialControllerSource = await readFile(
    new URL('../src/app/useTutorialController.js', import.meta.url),
    'utf8',
  );
  const overlaySource = await readFile(
    new URL('../src/app/components/TutorialOverlay.jsx', import.meta.url),
    'utf8',
  );
  const topBarSource = await readFile(new URL('../src/app/components/TopBar.jsx', import.meta.url), 'utf8');

  assert.match(source, /TutorialOverlay/);
  assert.match(source, /className="app-main"/);
  assert.match(source, /const workspaceClassName = \[/);
  assert.match(source, /<main className=\{workspaceClassName\}>/);
  assert.match(source, /<main className=\{workspaceClassName\}>[\s\S]*createElement\(TracksColumn[\s\S]*createElement\(Timeline[\s\S]*createElement\(TutorialOverlay[\s\S]*<\/main>/);
  assert.match(source, /tutorialSidebarCollapsed/);
  assert.match(source, /setTutorialSidebarCollapsed/);
  assert.match(source, /tutorialModeActive/);
  assert.match(source, /useTutorialController\(\{/);
  assert.match(tutorialControllerSource, /const tutorialActive = tutorialVisible && tutorialModeActive;/);
  assert.match(source, /showTutorialToggle:\s*true/);
  assert.match(source, /onTutorialToggle:\s*handleTutorialSidebarToggle/);
  assert.match(source, /tutorialCollapsed:\s*tutorialSidebarCollapsed/);
  assert.doesNotMatch(source, /showTutorialReopen/);
  assert.doesNotMatch(source, /onTutorialReopen/);
  assert.match(source, /DRUMS_TUTORIAL_STEPS/);
  assert.match(source, /currentTutorialStepIndex/);
  assert.match(tutorialControllerSource, /getTutorialViewModel/);
  assert.match(tutorialControllerSource, /const activeTutorialTarget = tutorialActive \? currentTutorialStep\?\.target\?\.name \?\? null : null;/);
  assert.match(tutorialControllerSource, /const activeTutorialTargets = tutorialActive \? tutorialViewModel\.targets : undefined;/);
  assert.match(tutorialControllerSource, /const activeTutorialLocked = tutorialActive && tutorialViewModel\.locked;/);
  assert.match(source, /tutorialViewModel\.displayCopy/);
  assert.match(source, /countInValue:\s*tutorialCountInValue/);
  assert.match(source, /APP_COMMAND_TYPES\.TRANSPORT_STOP/);
  assert.match(source, /stopTutorialPreviewPlayback/);
  assert.match(overlaySource, /tutorial-panel/);
  assert.match(overlaySource, /collapsed/);
  assert.match(overlaySource, /directoryItems/);
  assert.match(overlaySource, /onDirectorySelect/);
  assert.match(overlaySource, /<div className="tutorial-panel-header">\s*\n\s*<div className="tutorial-panel-label">教程<\/div>[\s\S]*className="tutorial-directory"[\s\S]*<\/div>\s*\n\s*<div className="tutorial-panel-body">/);
  assert.doesNotMatch(overlaySource, /tutorial-panel-title-row/);
  assert.doesNotMatch(overlaySource, /<div className="tutorial-panel-body">[\s\S]*className="tutorial-directory"[\s\S]*renderTutorialCopy/);
  assert.match(overlaySource, /className="tutorial-directory"/);
  assert.match(overlaySource, /className=\{directoryButtonClassName\}/);
  assert.match(overlaySource, /onClick=\{\(\) => onDirectorySelect\(item\.stepIndex\)\}/);
  assert.doesNotMatch(overlaySource, /onToggleCollapsed/);
  assert.doesNotMatch(overlaySource, /\bonClose\b/);
  assert.match(overlaySource, /if \(collapsed\) return null;/);
  assert.doesNotMatch(overlaySource, /tutorial-panel-tools/);
  assert.doesNotMatch(overlaySource, /tutorial-icon-button/);
  assert.doesNotMatch(overlaySource, /ChevronLeft/);
  assert.doesNotMatch(overlaySource, /\bX\b/);
  assert.doesNotMatch(overlaySource, /tutorial-reopen-button/);
  assert.doesNotMatch(topBarSource, /ChevronLeft/);
  assert.doesNotMatch(topBarSource, /ChevronRight/);
  assert.match(topBarSource, /showTutorialToggle/);
  assert.match(topBarSource, /onTutorialToggle/);
  assert.match(topBarSource, /tutorialCollapsed/);
  assert.match(topBarSource, /tutorialToggleLabel:\s*tutorialToggleLabelOverride/);
  assert.match(topBarSource, /tutorialToggleLabelOverride[\s\S]*tutorialCollapsed \? '展开教程' : '收起教程'/);
  assert.doesNotMatch(topBarSource, /TutorialToggleIcon/);
  assert.match(topBarSource, /className="key-switch tutorial-switch"/);
  assert.doesNotMatch(topBarSource, /className="tutorial-topbar-button icon-btn"/);
  assert.match(topBarSource, /aria-label=\{tutorialToggleLabel\}/);
  assert.match(topBarSource, /title=\{tutorialToggleLabel\}/);
  assert.match(topBarSource, />\s*教程\s*<\/button>/);
  assert.doesNotMatch(topBarSource, /showTutorialReopen/);
  assert.doesNotMatch(topBarSource, /onTutorialReopen/);
  assert.match(overlaySource, /displayCopy/);
  assert.match(overlaySource, /countInValue/);
  assert.match(overlaySource, /renderTutorialCopy/);
  assert.match(overlaySource, /\.split\('\\n\\n'\)/);
  assert.match(overlaySource, /\.split\('\\n'\)/);
  assert.match(overlaySource, /className="tutorial-copy"/);
  assert.match(overlaySource, /className="tutorial-copy-title"/);
  assert.match(overlaySource, /className="tutorial-copy-subtitle"/);
  assert.match(overlaySource, /className="tutorial-copy-body"/);
  assert.match(overlaySource, /className="tutorial-count-in"/);
  assert.match(overlaySource, /aria-live="assertive"/);
  assert.doesNotMatch(overlaySource, /isTutorialActionHintLine/);
  assert.doesNotMatch(overlaySource, /tutorial-copy-action-hint/);
  assert.doesNotMatch(overlaySource, /className="tutorial-copy-line"/);
  assert.doesNotMatch(overlaySource, /<p>\{displayCopy \?\? step\.copy\}<\/p>/);
  assert.match(overlaySource, /showCompleteButton/);
  assert.match(overlaySource, /const showPrimaryButton = showCompleteButton \|\| canManualNext;/);
  assert.match(overlaySource, /\{showPrimaryButton \? \(\s*<button[\s\S]*className="tutorial-primary"[\s\S]*<\/button>\s*\) : null\}/);
  assert.match(overlaySource, /primaryLabel/);
  assert.match(overlaySource, /primaryDisabled/);
  assert.match(overlaySource, /onPrimaryAction/);
  assert.match(overlaySource, /跳过教程/);
  assert.doesNotMatch(overlaySource, /getTutorialPlacement/);
  assert.doesNotMatch(overlaySource, /data-placement=/);
  assert.doesNotMatch(overlaySource, /targetName/);
  assert.doesNotMatch(overlaySource, /step\.phase/);
  assert.doesNotMatch(overlaySource, /step\.title/);
  assert.doesNotMatch(overlaySource, /tutorial-phase/);
  assert.doesNotMatch(overlaySource, /正在指引/);
  assert.doesNotMatch(overlaySource, /tutorial-target-note/);
});

test('tutorial navigation buttons interrupt preview playback', async () => {
  const source = await readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8');
  const tutorialControllerSource = await readFile(
    new URL('../src/app/useTutorialController.js', import.meta.url),
    'utf8',
  );

  assert.match(source, /const stopTutorialPreviewPlayback = useCallback/);
  assert.match(source, /const resetTutorialTransportToStart = useCallback/);
  assert.match(source, /resetTutorialTransportToStart = useCallback\(async \(\) => \{[\s\S]*APP_COMMAND_TYPES\.TRANSPORT_STOP[\s\S]*APP_COMMAND_TYPES\.TRANSPORT_SEEK,\s*bar:\s*0,\s*step:\s*0/);
  assert.match(source, /handleBackToStart = useCallback\(\(\) => \{[\s\S]*clearTutorialCountIn\(\);[\s\S]*APP_COMMAND_TYPES\.TRANSPORT_SEEK,\s*bar:\s*0,\s*step:\s*0/);
  assert.match(source, /handleStop = useCallback\(\(\) => \{[\s\S]*clearTutorialCountIn\(\);[\s\S]*APP_COMMAND_TYPES\.TRANSPORT_STOP/);
  assert.doesNotMatch(source, /tutorialPlaybackStateRef/);
  assert.match(source, /let tutorialAutoAdvanceTimerId = null/);
  assert.match(source, /function clearTutorialAutoAdvanceTimer\(\)/);
  assert.match(source, /window\.clearTimeout\(tutorialAutoAdvanceTimerId\)/);
  assert.match(source, /function scheduleTutorialAutoAdvance\(callback, delay = TUTORIAL_AUTO_ADVANCE_MS\)/);
  assert.match(tutorialControllerSource, /const \[tutorialCountInValue,\s*setTutorialCountInValue\] = useState\(null\);/);
  assert.match(tutorialControllerSource, /const tutorialCountInTimerIdsRef = useRef\(\[\]\);/);
  assert.match(tutorialControllerSource, /const clearTutorialCountIn = useCallback\(\(\) => \{[\s\S]*tutorialCountInTimerIdsRef\.current\.forEach\(\(timerId\) => window\.clearTimeout\(timerId\)\);[\s\S]*setTutorialCountInValue\(null\);/);
  assert.match(tutorialControllerSource, /const TUTORIAL_COUNT_IN_BEATS = Object\.freeze\(\[1,\s*2,\s*3\]\);/);
  assert.match(tutorialControllerSource, /const TUTORIAL_COUNT_IN_BEAT_MULTIPLIER = 1\.5;/);
  assert.match(tutorialControllerSource, /const startTutorialCountInPlayback = useCallback\(\(\) => \{[\s\S]*clearTutorialCountIn\(\);[\s\S]*const secondsPerBeat = \(60 \/ bpm\) \* TUTORIAL_COUNT_IN_BEAT_MULTIPLIER;[\s\S]*TUTORIAL_COUNT_IN_BEATS\.forEach/);
  assert.match(tutorialControllerSource, /startTutorialCountInPlayback[\s\S]*audioEngine\.triggerDrumsStep\('hihat'\)/);
  assert.match(tutorialControllerSource, /startTutorialCountInPlayback[\s\S]*APP_COMMAND_TYPES\.TRANSPORT_TOGGLE_PLAY/);
  assert.match(tutorialControllerSource, /tutorialCountInTimerIdsRef\.current = nextTimerIds;/);
  assert.match(source, /handleTutorialPlaybackComplete/);
  assert.match(source, /handleTutorialPlaybackPosition/);
  assert.match(source, /onPositionChange[\s\S]*handleTutorialPlaybackComplete/);
  assert.match(source, /onPositionChange[\s\S]*handleTutorialPlaybackPosition/);
  assert.match(source, /setTutorialProgress\(\(progress\) => \{[\s\S]*handleTutorialPlaybackPosition\(\{[\s\S]*progress,[\s\S]*step: currentTutorialStep/);
  assert.doesNotMatch(source, /handleTutorialPlaybackPosition\(\{[\s\S]*progress: tutorialProgress,[\s\S]*trackId: 'chord'/);
  assert.match(source, /const dispatchInputCommand = useCallback\(\(command\) => \{[\s\S]*command\?\.type === APP_COMMAND_TYPES\.TRANSPORT_TOGGLE_PLAY[\s\S]*handlePlayToggle\(\);[\s\S]*return;[\s\S]*void dispatchAppCommand\(command\);/);
  assert.match(source, /useKeyboardCommands\(\{[\s\S]*dispatch: dispatchInputCommand,[\s\S]*hasTimelineSelection: Boolean\(timelineSelection\),[\s\S]*\}\)/);
  assert.match(source, /useLaunchpadXCommands\(\{[\s\S]*dispatch: dispatchInputCommand,[\s\S]*drumsActive,[\s\S]*selectedBar,[\s\S]*\}\)/);
  assert.doesNotMatch(source, /useKeyboardCommands\(\{ dispatch: dispatchAppCommand \}\)/);
  assert.match(source, /applyTutorialActionProgress,[\s\S]*currentTutorialStep,[\s\S]*tutorialProgress,[\s\S]*tutorialActive/);
  assert.match(tutorialControllerSource, /const tutorialDirectoryItems = useMemo/);
  assert.match(tutorialControllerSource, /TUTORIAL_DIRECTORY_ITEMS\.map/);
  assert.match(tutorialControllerSource, /DRUMS_TUTORIAL_STEPS\.findIndex\(\(step\) => step\.id === item\.stepId\)/);
  assert.doesNotMatch(tutorialControllerSource, /disabled:\s*!tutorialStepCheckpoints\[stepIndex\]/);
  assert.match(tutorialControllerSource, /disabled:\s*false/);
  assert.match(tutorialControllerSource, /active:\s*stepIndex <= currentTutorialStepIndex && nextDirectoryStepIndex > currentTutorialStepIndex/);
  assert.match(source, /ensureTutorialStepCheckpoint = useCallback/);
  assert.match(source, /stopTutorialPreviewPlayback\(\);[\s\S]*setCurrentTutorialStepIndex/);
  assert.match(source, /handleTutorialBack = useCallback\(\(\) => \{[\s\S]*stopTutorialPreviewPlayback\(\);/);
  assert.match(source, /handleTutorialBack = useCallback\(\(\) => \{[\s\S]*clearTutorialAutoAdvanceTimer\(\);[\s\S]*stopTutorialPreviewPlayback\(\);/);
  assert.match(source, /tutorialStepCheckpoints/);
  assert.match(source, /createTutorialCheckpoint/);
  assert.match(source, /restoreTutorialCheckpoint/);
  assert.match(source, /pruneTutorialCheckpoints/);
  assert.match(source, /enterTutorialStepIndex/);
  assert.match(source, /const nextStepCheckpoint = createTutorialCheckpoint\(\{[\s\S]*appState: useMusicStore\.getState\(\)/);
  assert.match(source, /setTutorialStepCheckpoints\(\(checkpoints\) => \(\{[\s\S]*\[nextStepIndex\]: nextStepCheckpoint/);
  assert.match(source, /setTutorialStepCheckpoints\(\(checkpoints\) => \(\{[\s\S]*applyTutorialStepSetup\(nextStep\)/);
  assert.match(source, /advanceTutorialToNextStep\([\s\S]*tutorialAction\.nextProgress,\s*\{[\s\S]*startPlaybackAfterAdvance:\s*tutorialAction\.shouldStartPlaybackAfterAdvance/);
  assert.match(source, /const advanceTutorialToNextStep = useCallback\(\([\s\S]*checkpointProgress = tutorialProgress,[\s\S]*options = \{\},[\s\S]*\) => \{[\s\S]*await resetTutorialTransportToStart\(\);[\s\S]*enterTutorialStepIndex\(currentTutorialStepIndex \+ 1,\s*checkpointProgress\);[\s\S]*if \(options\.startPlaybackAfterAdvance\)[\s\S]*startTutorialCountInPlayback\(\);/);
  assert.doesNotMatch(source, /if \(options\.startPlaybackAfterAdvance\) \{\s*\n\s*await dispatchAppCommand\(\{ type: APP_COMMAND_TYPES\.TRANSPORT_TOGGLE_PLAY \}\);/);
  assert.match(source, /const targetStepIndex = Math\.max\(currentTutorialStepIndex - 1, 0\);/);
  assert.match(source, /const targetCheckpoint = ensureTutorialStepCheckpoint\(targetStepIndex\);/);
  assert.match(source, /restoreTutorialCheckpoint\(\{[\s\S]*checkpoint:\s*targetCheckpoint/);
  assert.match(source, /applyTutorialStepSetup\([\s\S]*DRUMS_TUTORIAL_STEPS\[targetStepIndex\],[\s\S]*targetCheckpoint\?\.appliedTutorialSetups/);
  assert.match(source, /pruneTutorialCheckpoints\([\s\S]*targetStepIndex \+ 1/);
  assert.match(source, /setCurrentTutorialStepIndex\(targetStepIndex\)/);
  assert.match(source, /handleTutorialJumpToSection = useCallback\(\(targetStepIndex\) => \{[\s\S]*clearTutorialAutoAdvanceTimer\(\);[\s\S]*stopTutorialPreviewPlayback\(\);[\s\S]*const targetCheckpoint = ensureTutorialStepCheckpoint\(targetStepIndex\);[\s\S]*restoreTutorialCheckpoint\(\{[\s\S]*checkpoint:\s*targetCheckpoint/);
  assert.match(source, /handleTutorialJumpToSection = useCallback\(\(targetStepIndex\) => \{[\s\S]*applyTutorialStepSetup\([\s\S]*DRUMS_TUTORIAL_STEPS\[targetStepIndex\],[\s\S]*targetCheckpoint\?\.appliedTutorialSetups/);
  assert.match(source, /handleTutorialJumpToSection = useCallback\(\(targetStepIndex\) => \{[\s\S]*setCurrentTutorialStepIndex\(targetStepIndex\);[\s\S]*setTutorialModeActive\(true\);[\s\S]*setTutorialSidebarCollapsed\(false\);/);
  assert.doesNotMatch(source, /tutorialStepCheckpoints\[currentTutorialStepIndex\]/);
  assert.doesNotMatch(source, /TUTORIAL_BACK_TARGET_RESET_STEP_IDS/);
  assert.doesNotMatch(source, /resetTutorialStepsForBack/);
  assert.doesNotMatch(source, /resetTutorialStepForRetry/);
  assert.match(source, /handleTutorialNext = useCallback\(\(\) => \{[\s\S]*clearTutorialAutoAdvanceTimer\(\);[\s\S]*clearTutorialCountIn\(\);[\s\S]*advanceTutorialToNextStep\(tutorialProgress\);/);
  assert.match(source, /handleTutorialOpenClip = useCallback\(\(clip\) => \{[\s\S]*advanceTutorialToNextStep\(tutorialAction\.nextProgress\);/);
  assert.match(source, /if \(tutorialAction\.shouldCompleteTutorial\)[\s\S]*clearTutorialAutoAdvanceTimer\(\);[\s\S]*clearTutorialCountIn\(\);[\s\S]*stopTutorialPreviewPlayback\(\);[\s\S]*resetTutorialTransportToStart\(\);[\s\S]*setTutorialModeActive\(false\);[\s\S]*setTutorialSidebarCollapsed\(true\);[\s\S]*return;/);
  assert.match(source, /handleTutorialSkip = useCallback\(\(\) => \{[\s\S]*const initialAppState = useMusicStore\.getInitialState\(\);[\s\S]*const skippedAppState = createTutorialSkipAppState\(initialAppState\);[\s\S]*clearTutorialAutoAdvanceTimer\(\);[\s\S]*clearTutorialCountIn\(\);[\s\S]*stopTutorialPreviewPlayback\(\);[\s\S]*useMusicStore\.setState\(skippedAppState, true\);[\s\S]*setCurrentTutorialStepIndex\(0\);[\s\S]*setTutorialProgress\(createTutorialState\(\)\);[\s\S]*setAppliedTutorialSetups\(\(\) => new Set\(\)\);[\s\S]*setTutorialStepCheckpoints\(\(\) => \(\{[\s\S]*0: createTutorialCheckpoint\(\{[\s\S]*appState: initialAppState,[\s\S]*appliedTutorialSetups: new Set\(\),[\s\S]*tutorialProgress: createTutorialState\(\),[\s\S]*\}\),[\s\S]*\}\)\);[\s\S]*setTutorialModeActive\(false\);[\s\S]*setTutorialSidebarCollapsed\(true\);[\s\S]*setTutorialVisible\(true\);/);
  const skipHandlerSource = source.match(
    /const handleTutorialSkip = useCallback\(\(\) => \{[\s\S]*?\n {2}\}, \[/,
  )?.[0] ?? '';
  assert.doesNotMatch(skipHandlerSource, /setTutorialVisible\(false\);/);
  assert.doesNotMatch(source, /handleTutorialSkip = useCallback\(\(\) => \{[\s\S]*restoreTutorialCheckpoint/);
  assert.match(source, /tutorialTargets:\s*activeTutorialTargets/);
  assert.match(source, /tutorialLocked:\s*activeTutorialLocked/);
  assert.doesNotMatch(source, /tutorialTargets:\s*tutorialViewModel\.targets/);
  assert.doesNotMatch(source, /tutorialLocked:\s*tutorialViewModel\.locked/);
  assert.doesNotMatch(source, /tutorialLocked:\s*tutorialVisible && tutorialViewModel\.locked/);
  assert.match(source, /onSkip:\s*handleTutorialSkip/);
  assert.match(source, /directoryItems:\s*tutorialDirectoryItems/);
  assert.match(source, /onDirectorySelect:\s*handleTutorialJumpToSection/);
  assert.doesNotMatch(source, /onClose:\s*handleTutorialSkip/);
});

test('tutorial preview points to real app regions', async () => {
  const source = await readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8');
  const topBarSource = await readFile(new URL('../src/app/components/TopBar.jsx', import.meta.url), 'utf8');
  const timelineSource = await readFile(
    new URL('../src/app/components/Timeline.jsx', import.meta.url),
    'utf8',
  );
  const bottomEditorSource = await readFile(
    new URL('../src/app/components/BottomEditor.jsx', import.meta.url),
    'utf8',
  );
  const overlaySource = await readFile(
    new URL('../src/app/components/TutorialOverlay.jsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /activeTutorialTarget/);
  assert.match(topBarSource, /data-tutorial-target="top-bar"/);
  assert.match(topBarSource, /tutorial-target-active/);
  assert.match(timelineSource, /data-tutorial-target="track-area"/);
  assert.doesNotMatch(timelineSource, /tutorial-target-active/);
  assert.doesNotMatch(timelineSource, /activeTutorialTarget === 'track-area'/);
  assert.match(bottomEditorSource, /data-tutorial-target="track-editor"/);
  assert.match(bottomEditorSource, /tutorial-target-active/);
  assert.doesNotMatch(overlaySource, /getTutorialPlacement\(targetName\)/);
});

test('app routes drums tutorial tasks through guards and target props', async () => {
  const source = await readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8');
  const timelineSource = await readFile(
    new URL('../src/app/components/Timeline.jsx', import.meta.url),
    'utf8',
  );
  const bottomEditorSource = await readFile(
    new URL('../src/app/components/BottomEditor.jsx', import.meta.url),
    'utf8',
  );
  const drumSequencerSource = await readFile(
    new URL('../src/app/components/DrumSequencer.jsx', import.meta.url),
    'utf8',
  );
  const tracksColumnSource = await readFile(
    new URL('../src/app/components/TracksColumn.jsx', import.meta.url),
    'utf8',
  );
  const topBarSource = await readFile(new URL('../src/app/components/TopBar.jsx', import.meta.url), 'utf8');
  const tutorialControllerSource = await readFile(
    new URL('../src/app/useTutorialController.js', import.meta.url),
    'utf8',
  );
  const tutorialRuntimeSource = await readFile(
    new URL('../src/tutorial/drumsTutorialRuntime.js', import.meta.url),
    'utf8',
  );

  assert.match(source, /handleTutorialDrumToggle/);
  assert.match(source, /handleTutorialDrumMove/);
  assert.match(source, /handleTutorialClipOpen/);
  assert.match(source, /handleTutorialControlAction/);
  assert.match(source, /handleTutorialPlaybackComplete/);
  assert.match(source, /handleTutorialPlaybackPosition/);
  assert.doesNotMatch(source, /handleTutorialPlayheadDrag/);
  assert.match(source, /handleTransportSeek/);
  assert.match(source, /if \(!tutorialAction\.allowed\) return false;\n\n {4}withUndoCheckpoint\(\(\) => \{\n {6}setTutorialProgress\(tutorialAction\.nextProgress\);\n\n {6}if \(tutorialAction\.shouldAdvance\)/);
  assert.match(source, /if \(tutorialAction\.shouldEnd\)[\s\S]*setTutorialVisible\(false\)/);
  assert.match(source, /if \(tutorialAction\.shouldCompleteTutorial\)[\s\S]*setTutorialSidebarCollapsed\(true\)/);
  assert.match(source, /handleTutorialOpenClip/);
  assert.match(source, /createDrumsStepMovePatch/);
  assert.match(source, /completeTutorialPrimaryAction/);
  assert.doesNotMatch(source, /completeTutorialTask4/);
  assert.match(source, /getDrumsCellInstruments/);
  assert.match(source, /const preview = !getDrumsCellInstruments\(currentCell\)\.includes\(instrument\)/);
  assert.match(source, /instrument,\n {8}preview,/);
  assert.match(source, /instrument,\n {8}preview: true,/);
  assert.match(tutorialControllerSource, /tutorialViewModel\.targets/);
  assert.match(tutorialControllerSource, /tutorialViewModel\.locked/);
  assert.match(source, /tutorialViewModel\.primaryLabel/);
  assert.match(source, /tutorialViewModel\.primaryDisabled/);
  assert.match(source, /onDrumsStepMove:\s*handleDrumsStepMove/);
  assert.match(topBarSource, /tutorialTargets/);
  assert.match(topBarSource, /getTutorialControlRole\(tutorialTargets,\s*'transport-play'\)/);
  assert.match(topBarSource, /const transportClassName = \[/);
  assert.match(topBarSource, /playTutorialRole === 'target' \? 'tutorial-control-target tutorial-transport-target' : ''/);
  assert.match(topBarSource, /<div className=\{transportClassName\} role="toolbar" aria-label="Transport">/);
  assert.doesNotMatch(topBarSource, /playTutorialRole === 'target' \? 'tutorial-control-target' : ''/);
  assert.match(topBarSource, /tutorial-control-target/);
  assert.match(tracksColumnSource, /tutorialTargets/);
  assert.match(tracksColumnSource, /getTutorialControlRole\(tutorialTargets,\s*`fill-empty-clips:\$\{track\.id\}`\)/);
  assert.match(tracksColumnSource, /tutorial-control-target/);
  assert.match(timelineSource, /tutorialTargets/);
  assert.match(timelineSource, /tutorial-bar-target/);
  assert.match(timelineSource, /getTutorialBarClass\(tutorialBarRole\)/);
  assert.doesNotMatch(timelineSource, /className=\{\[dropZoneClass,\s*getTutorialBarClass\(tutorialBarRole\)\]/);
  assert.match(timelineSource, /tutorialTargets\?\.playhead/);
  assert.match(timelineSource, /tutorial-playhead-target/);
  assert.match(timelineSource, /playheadLineClass/);
  assert.match(timelineSource, /className=\{playheadLineClass\}/);
  assert.match(timelineSource, /className=\{playheadGridClass\}/);
  assert.doesNotMatch(timelineSource, /playhead-hit',\s*\n\s*tutorialPlayheadRole === 'target'/);
  assert.match(timelineSource, /onTutorialOpenClip/);
  assert.match(bottomEditorSource, /tutorialTargets/);
  assert.match(bottomEditorSource, /tutorialLocked/);
  assert.match(bottomEditorSource, /createElement\(ChordEditor,[\s\S]*tutorialLocked,[\s\S]*tutorialTargets/);
  const chordEditorSource = await readFile(
    new URL('../src/app/components/ChordEditor.jsx', import.meta.url),
    'utf8',
  );
  assert.match(chordEditorSource, /getTutorialControlRole/);
  assert.match(chordEditorSource, /chord-template-workspace-button/);
  assert.match(chordEditorSource, /chord-template-card:\$\{template\.id\}/);
  assert.match(chordEditorSource, /chord-groove-card:\$\{template\.id\}/);
  assert.match(chordEditorSource, /chord-template-apply/);
  assert.doesNotMatch(chordEditorSource, /chord-template-apply-current|chord-template-apply-global/);
  assert.match(chordEditorSource, /tutorial-control-target/);
  assert.match(source, /handleChordTemplateWorkspaceApply = useCallback\([\s\S]*handleTutorialControlAction\(\{[\s\S]*CHORD_TEMPLATE_APPLY/);
  assert.doesNotMatch(source, /CHORD_TEMPLATE_APPLY_CURRENT|CHORD_TEMPLATE_APPLY_GLOBAL/);
  assert.match(tutorialRuntimeSource, /CHORD_SELECT_PROGRESSION_TEMPLATE[\s\S]*CHORD_TEMPLATE_WORKSPACE_BUTTON[\s\S]*CHORD_TEMPLATE_APPLY/);
  assert.match(tutorialRuntimeSource, /CHORD_LISTEN_LOOP[\s\S]*CHORD_TEMPLATE_WORKSPACE_BUTTON[\s\S]*CHORD_GROOVE_CARD_PREFIX/);
  assert.match(tutorialRuntimeSource, /BASS_LISTEN_LOOP[\s\S]*BASS_GROOVE_BUTTON[\s\S]*BASS_GROOVE_CARD_PREFIX/);
  assert.doesNotMatch(source, /handleChordPick|handlePassingChordPick|handleChordGrooveTemplateApply/);
  assert.match(drumSequencerSource, /getTutorialControlRole\(tutorialTargets,\s*'generate-current-drums-bar'\)/);
  assert.match(drumSequencerSource, /getTutorialControlRole\(tutorialTargets,\s*'generate-all-drums-bars'\)/);
  assert.match(drumSequencerSource, /data-tutorial-role=\{templateButtonRole/);
  assert.match(drumSequencerSource, /data-tutorial-role=\{generateCurrentRole/);
  assert.match(drumSequencerSource, /data-tutorial-role=\{generateAllRole/);
  assert.match(drumSequencerSource, /onStepMove/);
  assert.match(drumSequencerSource, /handleMouseDownStep/);
  assert.match(drumSequencerSource, /getDropTargetFromPoint/);
  assert.match(drumSequencerSource, /drag-over/);
  assert.match(drumSequencerSource, /tutorial-cell-target/);
  assert.match(drumSequencerSource, /tutorial-cell-target-blue/);
  assert.match(drumSequencerSource, /tutorial-cell-target-green/);
  assert.match(drumSequencerSource, /tutorial-cell-target-yellow/);
  assert.doesNotMatch(drumSequencerSource, /tutorial-cell-existing/);
  assert.doesNotMatch(drumSequencerSource, /tutorial-cell-existing-blue/);
  assert.doesNotMatch(drumSequencerSource, /tutorial-cell-existing-green/);
  assert.doesNotMatch(drumSequencerSource, /tutorial-cell-existing-yellow/);
  assert.doesNotMatch(drumSequencerSource, /tutorial-cell-completed/);
  assert.doesNotMatch(drumSequencerSource, /tutorialRole\.startsWith\('existing'\)/);
  assert.doesNotMatch(drumSequencerSource, /tutorialRole\.startsWith\('completed'\)/);
  assert.match(drumSequencerSource, /getTutorialControlRole\(tutorialTargets,\s*'generate-current-drums-bar'\)/);
  assert.match(drumSequencerSource, /getTutorialControlRole\(tutorialTargets,\s*'generate-all-drums-bars'\)/);
  assert.match(drumSequencerSource, /tutorial-cell-source/);
});
