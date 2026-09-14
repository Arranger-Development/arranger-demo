import {
  AudioWaveform,
  Play,
  Square,
  X,
} from 'lucide-react';
import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  getDrumTemplateGenre,
  getDrumTemplateHitFeel,
  getDrumTemplatesForGenre,
} from '../../data/drumStyleTemplates.js';
import { STEPS_PER_BAR } from '../../domain/musicConstants.js';
import { DRUM_INPUT_CELLS } from '../../input/drumsInputLayout.js';
import {
  DRUM_SEQUENCER_ROWS,
  isDrumsStepActive,
} from '../drumSequencerData.js';
import { DRUMS_RECORDING_PHASES } from '../drumsLiveRecording.js';
import {
  hasExistingDrumsClipContent,
} from '../drumsPatternActions.js';
import { MAX_PROJECT_BARS } from '../../domain/projectLength.js';
import { formatDisplayPosition } from '../transportPosition.js';
import { getTutorialControlRole } from '../../tutorial/drumsTutorialRuntime.js';
import { useSecondaryMenuDismiss } from '../useSecondaryMenuDismiss.js';
import { ClipNameInput } from './ClipNameInput.jsx';
import { EditorTrackIdentity } from './EditorTrackIdentity.jsx';
import { renderIcon } from './icons.js';
import { TrackBarPager } from './TrackBarPager.jsx';

const STEP_NUMBERS = Array.from({ length: STEPS_PER_BAR }, (_, index) => index + 1);
const STEPS_PER_BEAT_GROUP = 4;
const STEP_GROUPS = Array.from(
  { length: Math.ceil(STEP_NUMBERS.length / STEPS_PER_BEAT_GROUP) },
  (_, groupIndex) => STEP_NUMBERS.slice(
    groupIndex * STEPS_PER_BEAT_GROUP,
    (groupIndex + 1) * STEPS_PER_BEAT_GROUP,
  ),
);
const DRAG_THRESHOLD_PX = 6;
const EMPTY_TEMPLATE_PREVIEW = async () => 'empty';
const NOOP_TEMPLATE_PREVIEW_STOP = () => {};
const DRUM_TEMPLATE_HIT_LABELS = Object.freeze({
  hihat: 'H',
  kick: 'K',
  snare: 'S',
});
const DRUM_TEMPLATE_BEAT_MARKERS = new Set([1, 5, 9, 13]);
const TUTORIAL_CELL_COLOR_CLASSES = Object.freeze({
  target: Object.freeze({
    blue: 'tutorial-cell-target-blue',
    green: 'tutorial-cell-target-green',
    yellow: 'tutorial-cell-target-yellow',
  }),
});

function didPointerDrag(event, dragSession) {
  return Math.abs(event.clientX - dragSession.startX) > DRAG_THRESHOLD_PX
    || Math.abs(event.clientY - dragSession.startY) > DRAG_THRESHOLD_PX;
}

function getDropTargetFromPoint(event, dragSession) {
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.drum-step');
  if (!target) return null;
  if (target.dataset.instrument !== dragSession.instrument) return null;
  if (target.getAttribute('aria-disabled') === 'true') return null;
  if (target.getAttribute('aria-pressed') === 'true') return null;

  const step = Number(target.dataset.step);
  if (!Number.isInteger(step) || step === dragSession.step) return null;

  return { instrument: dragSession.instrument, step };
}

function getTutorialCellRole(tutorialTargets, bar, instrument, step) {
  const cellTargets = tutorialTargets?.drumCells ?? [];
  const target = cellTargets.find((item) => (
    item.bar === bar
    && item.instrument === instrument
    && item.steps.includes(step)
  ));

  return target?.role ?? null;
}

function getTutorialCellClasses(tutorialRole) {
  if (!tutorialRole) return [];

  if (tutorialRole.startsWith('target')) {
    return [
      'tutorial-cell-target',
      tutorialRole.endsWith('-blue') ? TUTORIAL_CELL_COLOR_CLASSES.target.blue : '',
      tutorialRole.endsWith('-green') ? TUTORIAL_CELL_COLOR_CLASSES.target.green : '',
      tutorialRole.endsWith('-yellow') ? TUTORIAL_CELL_COLOR_CLASSES.target.yellow : '',
    ];
  }
  if (tutorialRole === 'source') return ['tutorial-cell-source'];
  return [];
}

function getDrumTemplateHitLabel(template, rowId, stepIndex) {
  if (!template?.hits?.[rowId]?.includes(stepIndex)) return null;
  return DRUM_TEMPLATE_HIT_LABELS[rowId] ?? null;
}

function getDrumTemplateStepClass(template, rowId, stepIndex) {
  const hitLabel = getDrumTemplateHitLabel(template, rowId, stepIndex);

  return [
    'gtpl-step',
    'drum-template-step',
    stepIndex % 4 === 0 ? 'downbeat' : '',
    hitLabel ? 'hit-block' : '',
  ].filter(Boolean).join(' ');
}

function getDrumTemplateHitStrength(template, rowId, stepIndex) {
  if (!getDrumTemplateHitLabel(template, rowId, stepIndex)) return null;
  const { velocity } = getDrumTemplateHitFeel(template, rowId, stepIndex);
  if (velocity >= 0.9) return 'accent';
  if (velocity <= 0.45) return 'ghost';
  return 'normal';
}

function DrumSequencer({
  clips,
  matrix,
  canPageBars = false,
  clipName,
  drumsRecordingState,
  genreId = 'pop',
  hasClip = true,
  onClose = () => {},
  onClearCurrentBar,
  onClearDrums,
  onGenerateAllBars,
  onGenerateCurrentBar,
  onNextBar = () => {},
  onPreviousBar = () => {},
  onPadInput = () => {},
  onRecordCancel = () => {},
  onRecordConfirm = () => {},
  onStepMove,
  onStepToggle,
  onTemplatePreview = EMPTY_TEMPLATE_PREVIEW,
  onTemplatePreviewStop = NOOP_TEMPLATE_PREVIEW_STOP,
  onWriteToggle = () => {},
  onRenameClip,
  selectedBar,
  trackName = 'Drums',
  tutorialLocked = false,
  tutorialTargets,
}) {
  const [dragSource, setDragSource] = useState(null);
  const [dragOverStep, setDragOverStep] = useState(null);
  const [drumTemplatePickerOpen, setDrumTemplatePickerOpen] = useState(false);
  const [confirmApplyAllOpen, setConfirmApplyAllOpen] = useState(false);
  const drumTemplateGenre = getDrumTemplateGenre(genreId);
  const drumTemplates = getDrumTemplatesForGenre(genreId);
  const [selectedDrumTemplateId, setSelectedDrumTemplateId] = useState(
    () => drumTemplates.find((template) => template.default)?.id ?? drumTemplates[0]?.id,
  );
  const [previewingTemplateId, setPreviewingTemplateId] = useState(null);
  const [suppressNextClick, setSuppressNextClick] = useState(false);
  const dragSessionRef = useRef(null);
  const previewRequestRef = useRef(0);
  const templatePickerRef = useRef(null);
  const templateTriggerRef = useRef(null);
  const selectedDrumTemplate = drumTemplates.find(
    (template) => template.id === selectedDrumTemplateId,
  ) ?? drumTemplates[0];
  const recordingPhase = drumsRecordingState?.phase ?? DRUMS_RECORDING_PHASES.IDLE;
  const recordingActive = [
    DRUMS_RECORDING_PHASES.COUNT_IN,
    DRUMS_RECORDING_PHASES.RECORDING,
  ].includes(recordingPhase);
  const workflowLocked = recordingPhase !== DRUMS_RECORDING_PHASES.IDLE;
  const writeBarProgress = Number.isInteger(drumsRecordingState?.currentBar)
    && Number.isInteger(drumsRecordingState?.startBar)
    ? drumsRecordingState.currentBar - drumsRecordingState.startBar + 1
    : 0;
  const recordingStatus = recordingPhase === DRUMS_RECORDING_PHASES.COUNT_IN
    ? `预拍 ${drumsRecordingState.countInBeat}`
    : recordingPhase === DRUMS_RECORDING_PHASES.RECORDING
      ? `写入中 ${writeBarProgress}/${drumsRecordingState?.totalBars ?? 0}`
      : recordingPhase === DRUMS_RECORDING_PHASES.CONFIRM
        ? '等待确认覆盖'
        : null;
  const generateCurrentRole = getTutorialControlRole(tutorialTargets, 'generate-current-drums-bar');
  const generateAllRole = getTutorialControlRole(tutorialTargets, 'generate-all-drums-bars');
  const templateButtonRole = generateCurrentRole === 'target' || generateAllRole === 'target'
    ? 'target'
    : null;
  const templateButtonLocked = (tutorialLocked && templateButtonRole !== 'target')
    || workflowLocked
    || !hasClip;
  const generateCurrentLocked = (tutorialLocked && generateCurrentRole !== 'target')
    || workflowLocked
    || !hasClip;
  const generateAllLocked = (tutorialLocked && generateAllRole !== 'target')
    || workflowLocked
    || !hasClip;
  const templateButtonClassName = [
    'btn-template-groove',
    'drum-action',
    templateButtonRole === 'target' ? 'tutorial-control-target' : '',
  ].filter(Boolean).join(' ');
  const applyCurrentClassName = [
    'btn-template',
    'drum-template-apply',
    generateCurrentRole === 'target' ? 'tutorial-control-target' : '',
  ].filter(Boolean).join(' ');
  const applyAllClassName = [
    'btn-template',
    'drum-template-apply',
    generateAllRole === 'target' ? 'tutorial-control-target' : '',
  ].filter(Boolean).join(' ');

  const stopTemplatePreview = useCallback(() => {
    previewRequestRef.current += 1;
    onTemplatePreviewStop();
    setPreviewingTemplateId(null);
  }, [onTemplatePreviewStop]);

  const closeTemplatePicker = useCallback(() => {
    stopTemplatePreview();
    setConfirmApplyAllOpen(false);
    setDrumTemplatePickerOpen(false);
  }, [stopTemplatePreview]);

  const selectDrumTemplate = (templateId) => {
    if (templateId !== previewingTemplateId) stopTemplatePreview();
    setSelectedDrumTemplateId(templateId);
  };

  const handleTemplatePreview = async (templateId) => {
    if (previewingTemplateId === templateId) {
      stopTemplatePreview();
      return;
    }

    onTemplatePreviewStop();
    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;
    setSelectedDrumTemplateId(templateId);
    setPreviewingTemplateId(templateId);

    try {
      await onTemplatePreview(templateId);
    } finally {
      if (previewRequestRef.current === requestId) {
        setPreviewingTemplateId(null);
      }
    }
  };

  const handleMouseDownStep = (event, instrument, step, canDrag) => {
    if (!canDrag || event.button !== 0) return;
    const dragSession = {
      dragging: false,
      instrument,
      startX: event.clientX,
      startY: event.clientY,
      step,
    };
    dragSessionRef.current = dragSession;
    setDragSource({ instrument, step });
  };

  useEffect(() => {
    if (!dragSource) return undefined;

    const handleMouseMove = (event) => {
      const dragSession = dragSessionRef.current;
      if (!dragSession) return;
      if (!didPointerDrag(event, dragSession)) return;

      dragSession.dragging = true;
      const target = getDropTargetFromPoint(event, dragSession);
      setDragOverStep(target ? { instrument: target.instrument, step: target.step } : null);
    };

    const handleMouseUp = (event) => {
      const dragSession = dragSessionRef.current;
      const target = dragSession?.dragging ? getDropTargetFromPoint(event, dragSession) : null;

      if (dragSession?.dragging) {
        setSuppressNextClick(true);
      }
      if (target) {
        onStepMove?.(dragSession.instrument, dragSession.step, target.step);
      }

      dragSessionRef.current = null;
      setDragSource(null);
      setDragOverStep(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragSource, onStepMove]);

  useEffect(() => {
    onTemplatePreviewStop();
  }, [drumTemplateGenre.id, onTemplatePreviewStop]);

  useEffect(() => {
    if (workflowLocked) onTemplatePreviewStop();
  }, [onTemplatePreviewStop, workflowLocked]);

  useEffect(() => () => {
    previewRequestRef.current += 1;
    onTemplatePreviewStop();
  }, [onTemplatePreviewStop]);

  useSecondaryMenuDismiss({
    active: drumTemplatePickerOpen && !confirmApplyAllOpen,
    menuRef: templatePickerRef,
    onDismiss: closeTemplatePicker,
    triggerRef: templateTriggerRef,
  });

  useEffect(() => {
    if (!confirmApplyAllOpen) return undefined;

    const handleTemplateConfirmKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setConfirmApplyAllOpen(false);
    };

    window.addEventListener('keydown', handleTemplateConfirmKeyDown, true);
    return () => window.removeEventListener('keydown', handleTemplateConfirmKeyDown, true);
  }, [confirmApplyAllOpen]);

  useEffect(() => {
    if (recordingPhase !== DRUMS_RECORDING_PHASES.CONFIRM) return undefined;

    const handleRecordConfirmKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onRecordCancel();
    };

    window.addEventListener('keydown', handleRecordConfirmKeyDown, true);
    return () => window.removeEventListener('keydown', handleRecordConfirmKeyDown, true);
  }, [onRecordCancel, recordingPhase]);

  const handleTemplateCardKeyDown = (event, templateId) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    selectDrumTemplate(templateId);
  };

  const handleApplyCurrentTemplate = () => {
    stopTemplatePreview();
    onGenerateCurrentBar?.(selectedDrumTemplate?.id);
    setConfirmApplyAllOpen(false);
    setDrumTemplatePickerOpen(false);
  };

  const handleApplyAllTemplate = () => {
    stopTemplatePreview();
    if (hasExistingDrumsClipContent(matrix, clips)) {
      setConfirmApplyAllOpen(true);
      return;
    }

    onGenerateAllBars?.(selectedDrumTemplate?.id);
    setDrumTemplatePickerOpen(false);
  };

  const applyAllTemplate = () => {
    stopTemplatePreview();
    onGenerateAllBars?.(selectedDrumTemplate?.id);
    setConfirmApplyAllOpen(false);
    setDrumTemplatePickerOpen(false);
  };

  const handleClose = () => {
    closeTemplatePicker();
    onClose();
  };

  const handleWriteButtonClick = () => {
    stopTemplatePreview();
    setConfirmApplyAllOpen(false);
    setDrumTemplatePickerOpen(false);
    if (recordingPhase === DRUMS_RECORDING_PHASES.CONFIRM) {
      onRecordConfirm();
      return;
    }
    onWriteToggle();
  };

  const renderDrumStep = (row, stepNumber) => {
    const stepIndex = stepNumber - 1;
    const active = isDrumsStepActive(matrix, selectedBar, stepIndex, row.id);
    const tutorialRole = getTutorialCellRole(
      tutorialTargets,
      selectedBar,
      row.id,
      stepIndex,
    );
    const interactiveTutorialCell = tutorialRole?.startsWith('target')
      || tutorialRole === 'source';
    const locked = (tutorialLocked && !interactiveTutorialCell)
      || workflowLocked
      || !hasClip;
    const canDrag = active && !locked;
    const dragOver = dragOverStep?.instrument === row.id
      && dragOverStep.step === stepIndex;
    const positionLabel = formatDisplayPosition(selectedBar, stepIndex, MAX_PROJECT_BARS);

    return (
      <button
        className={[
          'drum-step',
          active ? 'active' : '',
          canDrag ? 'drum-step-drag-source' : '',
          dragOver ? 'drag-over' : '',
          stepNumber % 4 === 0 ? 'beat-end' : '',
          locked ? 'tutorial-locked' : '',
          ...getTutorialCellClasses(tutorialRole),
        ].filter(Boolean).join(' ')}
        data-instrument={row.id}
        data-step={stepIndex}
        data-tutorial-role={tutorialRole ?? undefined}
        key={`${row.id}-${stepNumber}`}
        type="button"
        aria-label={`Toggle ${row.label} at ${positionLabel}`}
        aria-pressed={active}
        aria-disabled={locked}
        disabled={locked}
        draggable={false}
        onMouseDown={(event) => handleMouseDownStep(event, row.id, stepIndex, canDrag)}
        onClick={() => {
          if (suppressNextClick) {
            setSuppressNextClick(false);
            return;
          }
          onStepToggle(row.id, stepIndex);
        }}
      />
    );
  };

  return (
    <section
      className="editor drum-editor"
      data-screen-label="Drum Sequencer"
      data-picker={drumTemplatePickerOpen ? 'drum-template' : undefined}
    >
      <header className="editor-head">
        <div className="editor-left">
          {createElement(EditorTrackIdentity, { trackId: 'drums', label: trackName })}
          <div className="clip-title">
            <div className="crumb">Drums · Phrase</div>
            {createElement(ClipNameInput, {
              clipName: hasClip ? clipName : '等待首次击打创建 Clip',
              disabled: !hasClip || workflowLocked,
              onRenameClip,
            })}
            <div className="clip-name-meta">
              <span>
                DRUM SEQUENCER - BAR
                {' '}
                {selectedBar + 1}
              </span>
              {recordingStatus ? (
                <span
                  className="drums-record-status-inline"
                  role="status"
                  aria-live="polite"
                >
                  {recordingStatus}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="tools">
          <button
            className={templateButtonClassName}
            ref={templateTriggerRef}
            type="button"
            aria-expanded={drumTemplatePickerOpen}
            aria-haspopup="dialog"
            data-tutorial-role={templateButtonRole}
            disabled={templateButtonLocked}
            onClick={() => {
              if (drumTemplatePickerOpen) {
                closeTemplatePicker();
              } else {
                setDrumTemplatePickerOpen(true);
              }
            }}
          >
            {renderIcon(AudioWaveform)}
            选择律动模板
          </button>
          <button
            className={[
              'btn-template',
              'drums-record-button',
              recordingActive ? 'recording' : '',
            ].filter(Boolean).join(' ')}
            aria-label={recordingActive ? '停止打击乐写入' : '开始打击乐写入'}
            type="button"
            disabled={tutorialLocked}
            onClick={handleWriteButtonClick}
          >
            {recordingPhase === DRUMS_RECORDING_PHASES.COUNT_IN
              ? `预拍 ${drumsRecordingState.countInBeat}`
              : recordingPhase === DRUMS_RECORDING_PHASES.RECORDING
                ? `写入中 ${writeBarProgress}/${drumsRecordingState?.totalBars ?? 0}`
                : recordingPhase === DRUMS_RECORDING_PHASES.CONFIRM
                  ? '确认重写'
                  : '写入'}
          </button>
          <button
            className="btn-template drum-clear-action"
            type="button"
            disabled={workflowLocked || !hasClip}
            onClick={() => {
              stopTemplatePreview();
              onClearCurrentBar?.();
            }}
          >
            清本小节
          </button>
          <button
            className="btn-template drum-clear-action"
            type="button"
            disabled={workflowLocked || !hasClip}
            onClick={() => {
              stopTemplatePreview();
              onClearDrums?.();
            }}
          >
            清整轨
          </button>
          <button
            className="editor-close"
            aria-label="Close editor"
            title="Close"
            type="button"
            onClick={handleClose}
          >
            {renderIcon(X)}
          </button>
        </div>
      </header>

      <div className="drum-seq-body">
        {createElement(TrackBarPager, {
          canPageBars: canPageBars && !workflowLocked,
          contentClassName: 'drum-seq-panel',
          onNextBar,
          onPreviousBar,
          trackId: 'drums',
        }, (
          <div className="drum-sequencer-grid">
            <div className="drum-row-labels" role="group" aria-label="虚拟鼓垫">
              <div className="drum-row-label-spacer" aria-hidden="true" />
              {DRUM_INPUT_CELLS.map((pad) => (
                <button
                  className="drum-row-label drum-performance-pad"
                  type="button"
                  data-instrument={pad.instrument}
                  disabled={tutorialLocked}
                  key={pad.instrument}
                  aria-label={`${pad.label} 鼓垫，键盘 ${pad.keyLabel}`}
                  onClick={(event) => {
                    if (event.detail === 0) {
                      onPadInput(pad.instrument, event.timeStamp);
                    }
                  }}
                  onPointerDown={(event) => {
                    if (event.button === 0) {
                      onPadInput(pad.instrument, event.timeStamp);
                    }
                  }}
                >
                  <span className="drum-dot" data-instrument={pad.instrument} />
                  <span className="drum-pad-label">{pad.label}</span>
                  <kbd className="drum-pad-key">{pad.keyLabel}</kbd>
                </button>
              ))}
            </div>

            <div className="drum-steps drum-step-groups">
              {STEP_GROUPS.map((stepGroup, groupIndex) => (
                <section
                  className="drum-step-group"
                  aria-label={`Beat ${groupIndex + 1}`}
                  key={groupIndex}
                >
                  <header className="drum-beat-header">
                    <span className="drum-beat-label mono">
                      BEAT
                      {' '}
                      {groupIndex + 1}
                    </span>
                    <div className="drum-beat-position-row" aria-hidden="true">
                      {stepGroup.map((stepNumber, beatStepIndex) => (
                        <span
                          className="drum-step-number mono"
                          key={stepNumber}
                        >
                          {beatStepIndex + 1}
                        </span>
                      ))}
                    </div>
                  </header>
                  {DRUM_SEQUENCER_ROWS.map((row) => (
                    <div
                      className="drum-beat-row"
                      data-instrument={row.id}
                      key={row.id}
                    >
                      {stepGroup.map((stepNumber) => renderDrumStep(row, stepNumber))}
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </div>
        ))}
      </div>

      {recordingPhase === DRUMS_RECORDING_PHASES.COUNT_IN ? (
        <div className="melody-record-count-in drums-record-count-in" role="status" aria-live="assertive">
          <span>预拍</span>
          <strong>{drumsRecordingState.countInBeat}</strong>
        </div>
      ) : null}

      <div
        className="gtpl-picker drum-template-picker"
        ref={templatePickerRef}
        role="dialog"
        aria-label="选择律动模板"
        data-screen-label="Drum Groove Template Picker"
        hidden={!drumTemplatePickerOpen}
      >
        <header className="tpl-head">
          <div className="tpl-head-left">
            <button className="btn-template-groove-active" aria-label="关闭选择律动模板" type="button" onClick={closeTemplatePicker}>
              {renderIcon(AudioWaveform)}
              选择律动模板
            </button>
            <span className="tpl-meta">
              {drumTemplateGenre.label}
              {' '}
              ·
              {' '}
              <span className="mono">{drumTemplates.length}</span>
              {' '}
              个
            </span>
          </div>
          <div className="tpl-head-right">
            <button className="tpl-close" aria-label="关闭" type="button" onClick={closeTemplatePicker}>
              {renderIcon(X)}
            </button>
          </div>
        </header>

        <div className="tpl-body">
          <div className="tpl-list drum-template-list">
            {drumTemplates.map((template) => {
              const previewing = previewingTemplateId === template.id;

              return (
                <article
                  className={[
                    'gtpl-card',
                    'drum-template-card',
                    selectedDrumTemplate?.id === template.id ? 'selected' : '',
                    previewing ? 'is-previewing' : '',
                  ].filter(Boolean).join(' ')}
                  data-drum-template={template.id}
                  key={template.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectDrumTemplate(template.id)}
                  onKeyDown={(event) => handleTemplateCardKeyDown(event, template.id)}
                >
                  <div className="gtpl-name-row">
                    <h3 className="gtpl-name">{template.name}</h3>
                    {template.default ? (
                      <span className="gtpl-default-tag">默认</span>
                    ) : null}
                  </div>
                  <div className="drum-template-feel">
                    <span>{template.feel.label}</span>
                    <span className="mono">
                      {template.feel.swing > 0
                        ? `Swing ${Math.round(template.feel.swing * 100)}%`
                        : 'Straight'}
                    </span>
                  </div>
                  <div className="gtpl-rhythm drum-template-rhythm" aria-label={`律动预览·${template.name}`}>
                    <div className="drum-template-beat-markers" aria-hidden="true">
                      <span />
                      <div className="drum-template-beat-marker-grid">
                        {STEP_NUMBERS.map((stepNumber) => (
                          <span className="drum-template-beat-marker mono" key={`beat-marker-${template.id}-${stepNumber}`}>
                            {DRUM_TEMPLATE_BEAT_MARKERS.has(stepNumber) ? stepNumber : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                    {DRUM_SEQUENCER_ROWS.map((row) => (
                      <div className="drum-template-row" key={row.id}>
                        <span className="drum-template-row-label">{row.label}</span>
                        <div className="drum-template-row-grid">
                          {STEP_NUMBERS.map((stepNumber) => {
                            const stepIndex = stepNumber - 1;
                            const hitLabel = getDrumTemplateHitLabel(
                              template,
                              row.id,
                              stepIndex,
                            );
                            const hitStrength = getDrumTemplateHitStrength(
                              template,
                              row.id,
                              stepIndex,
                            );

                            return (
                              <span
                                className={getDrumTemplateStepClass(template, row.id, stepIndex)}
                                data-instrument={row.id}
                                data-hit-label={hitLabel ?? undefined}
                                data-hit-strength={hitStrength ?? undefined}
                                key={`${template.id}-${row.id}-${stepNumber}`}
                                aria-label={hitLabel ? `${row.label} hit at step ${stepNumber}` : `${row.label} rest at step ${stepNumber}`}
                              >
                                {hitLabel ? (
                                  <span className="drum-template-hit-label" aria-hidden="true">
                                    {hitLabel}
                                  </span>
                                ) : null}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="drum-template-card-footer">
                    <p className="gtpl-desc">{template.description}</p>
                    <button
                      aria-label={`${previewing ? '停止试听' : '试听'} ${template.name}`}
                      aria-pressed={previewing}
                      className={[
                        'drum-template-preview',
                        previewing ? 'is-playing' : '',
                      ].filter(Boolean).join(' ')}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleTemplatePreview(template.id);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {renderIcon(previewing ? Square : Play)}
                      {previewing ? '停止' : '试听'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <footer className="tpl-pager drum-template-actions">
          <button
            className={applyCurrentClassName}
            type="button"
            data-tutorial-role={generateCurrentRole}
            disabled={generateCurrentLocked}
            onClick={handleApplyCurrentTemplate}
          >
            应用到本小节
          </button>
          <button
            className={applyAllClassName}
            type="button"
            data-tutorial-role={generateAllRole}
            disabled={generateAllLocked}
            onClick={handleApplyAllTemplate}
          >
            应用到整轨
          </button>
        </footer>
      </div>

      {confirmApplyAllOpen ? (
        <div className="tpl-confirm-overlay drums-template-confirm-overlay">
          <section
            className="tpl-confirm-dialog"
            aria-labelledby="drumsTemplateConfirmTitle"
            aria-modal="true"
            role="dialog"
          >
            <span className="tpl-confirm-kicker">DRUMS TEMPLATE</span>
            <h3 className="tpl-confirm-title" id="drumsTemplateConfirmTitle">
              是否覆盖已有 Drums 内容？
            </h3>
            <p className="tpl-confirm-copy">
              所选律动会原子覆盖全部已有 Drums Clips，确认后可使用撤销恢复。
            </p>
            <div className="tpl-confirm-template">
              <strong className="tpl-confirm-template-name">
                {selectedDrumTemplate?.name}
              </strong>
              <span className="tpl-confirm-template-chords">
                应用到整轨
              </span>
            </div>
            <div className="tpl-confirm-actions">
              <button
                className="tpl-confirm-cancel"
                type="button"
                onClick={() => setConfirmApplyAllOpen(false)}
              >
                取消
              </button>
              <button
                className="tpl-confirm-apply"
                type="button"
                onClick={applyAllTemplate}
              >
                覆盖并应用
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {recordingPhase === DRUMS_RECORDING_PHASES.CONFIRM ? (
        <div className="melody-record-confirm-overlay drums-record-confirm-overlay" role="presentation">
          <section
            className="melody-record-confirm-dialog drums-record-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drumsRecordConfirmTitle"
          >
            <span>DRUMS WRITE</span>
            <h2 id="drumsRecordConfirmTitle">
              是否覆盖第 {drumsRecordingState.startBar + 1}–{drumsRecordingState.endBar + 1} 小节已有鼓点？
            </h2>
            <p>
              播放到每个小节时才会清空；提前停止会保留尚未到达的小节。
            </p>
            <div>
              <button type="button" onClick={onRecordCancel}>取消</button>
              <button className="primary" type="button" onClick={onRecordConfirm}>
                覆盖并开始写入
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export { DrumSequencer };
