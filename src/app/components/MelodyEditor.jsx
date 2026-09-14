import {
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  formatMelodyNoteParts,
  getMelodyScale,
  getMelodyScaleNoteIds,
  getMelodyScalePreviewNotes,
  isMelodyScalePitchClass,
  MELODY_NOTES,
  MELODY_PITCH_CLASSES,
  MELODY_SCALES,
} from '../../data/melodyScales.js';
import {
  getMelodyStyleTemplate,
} from '../../data/melodyStyleTemplates.js';
import {
  getMelodyTimbre,
  MELODY_TIMBRES,
} from '../../data/melodyTimbres.js';
import {
  getMelodyInputGrid,
  getVirtualMelodyInputId,
  isMelodyInputAreaVisible,
  MELODY_INPUT_SOURCES,
} from '../../input/melodyInputLayout.js';
import {
  getMelodyCellRenderState,
  isMelodyCellActive,
} from '../melodyActions.js';
import {
  getMelodyRhythmTemplate,
} from '../melodyRhythmTemplates.js';
import { MELODY_RECORDING_PHASES } from '../useMelodyRecordingController.js';
import { getTutorialControlRole } from '../../tutorial/drumsTutorialRuntime.js';
import { BEAT_NUMBERS } from '../uiShellData.js';
import { useSecondaryMenuDismiss } from '../useSecondaryMenuDismiss.js';
import { ClipNameInput } from './ClipNameInput.jsx';
import { EditorTrackIdentity } from './EditorTrackIdentity.jsx';
import { renderIcon } from './icons.js';
import { PianoRoll } from './PianoRoll.jsx';
import { TrackBarPager } from './TrackBarPager.jsx';

const MELODY_EXAMPLE_DISPLAY_BY_TARGET = Object.freeze({
  AAFFGGF: 'AAFFGGF',
  GASDDSAGDSAG: 'GASD DSAG DS AG',
  FGDFGSFGAGAGASA: 'FGD FGS FGA GAGA SA',
});

function renderMelodyMiniGroove(template) {
  const rhythmSteps = template.rhythmSteps ?? template.steps ?? [];
  return BEAT_NUMBERS.map((beatNumber) => (
    <span
      className="chord-template-mini-beat-group"
      key={`${template.id}-beat-${beatNumber}`}
    >
      {BEAT_NUMBERS.map((stepNumber) => {
        const step = (beatNumber - 1) * 4 + stepNumber - 1;

        return (
          <span
            className={rhythmSteps.includes(step) ? 'on' : ''}
            key={`${template.id}-step-${step}`}
          />
        );
      })}
    </span>
  ));
}

function MelodyEditor({
  activeInputNotes = new Set(),
  canPageBars = false,
  clipName,
  matrix,
  melodyRecordingState,
  melodyRhythmTemplateId = null,
  melodyScaleId = 'chinese',
  melodyTimbreId = 'piano',
  onClearMelody,
  onClearMelodyBar,
  onClose = () => {},
  onNextBar = () => {},
  onPreviousBar = () => {},
  onMelodyPreview = () => {},
  onMelodyPreviewStop = () => {},
  onMelodyNoteOff = () => {},
  onMelodyNoteOn = () => {},
  onMelodyRecordCancel = () => {},
  onMelodyRecordConfirm = () => {},
  onMelodyWriteToggle = () => {},
  onMelodyStyleTemplateApply = () => {},
  onMelodyTimbrePrepare = () => Promise.resolve(false),
  onMelodyStepToggle = () => {},
  onRenameClip,
  selectedBar,
  trackId = 'melody',
  trackName = 'Melody',
  tutorialLocked = false,
  tutorialTargets,
}) {
  const [pickerMode, setPickerMode] = useState(null);
  const [selectedStyleTemplateId, setSelectedStyleTemplateId] = useState(
    melodyRhythmTemplateId ?? melodyScaleId,
  );
  const [selectedTimbreId, setSelectedTimbreId] = useState(melodyTimbreId);
  const [timbreActionState, setTimbreActionState] = useState('idle');
  const stylePickerRef = useRef(null);
  const styleTriggerRef = useRef(null);
  const timbreRequestIdRef = useRef(0);
  const closePicker = useCallback(() => {
    timbreRequestIdRef.current += 1;
    onMelodyPreviewStop();
    setTimbreActionState('idle');
    setPickerMode(null);
  }, [onMelodyPreviewStop]);
  useEffect(() => () => onMelodyPreviewStop(), [onMelodyPreviewStop]);
  useSecondaryMenuDismiss({
    active: pickerMode !== null,
    menuRef: stylePickerRef,
    onDismiss: closePicker,
    triggerRef: styleTriggerRef,
  });
  const styleButtonRole = getTutorialControlRole(tutorialTargets, 'melody-style-button');
  const styleButtonDisabled = tutorialLocked && styleButtonRole !== 'target';
  const exampleKeysTarget = tutorialTargets?.controls?.find((target) => (
    target.name?.startsWith?.('melody-example-keys:')
  ));
  const exampleKeysRole = exampleKeysTarget?.role ?? null;
  const exampleKeysId = exampleKeysTarget?.name?.slice('melody-example-keys:'.length) ?? '';
  const exampleKeysLabel = MELODY_EXAMPLE_DISPLAY_BY_TARGET[exampleKeysId] ?? exampleKeysId;
  const activeScale = getMelodyScale(melodyScaleId);
  const activeTimbre = getMelodyTimbre(melodyTimbreId);
  const selectedStyleTemplate = getMelodyStyleTemplate(selectedStyleTemplateId);
  const selectedTimbre = getMelodyTimbre(selectedTimbreId);
  const recordingPhase = melodyRecordingState?.phase ?? MELODY_RECORDING_PHASES.IDLE;
  const activeRhythmTemplate = getMelodyRhythmTemplate(
    melodyRecordingState?.templateId ?? melodyRhythmTemplateId,
  );
  const writeBarProgress = Number.isInteger(melodyRecordingState?.currentBar)
    && Number.isInteger(melodyRecordingState?.startBar)
    ? melodyRecordingState.currentBar - melodyRecordingState.startBar + 1
    : 0;
  const melodyInputVisible = isMelodyInputAreaVisible({
    hasTemplate: Boolean(activeRhythmTemplate),
    phase: recordingPhase,
  });
  const recordingActive = recordingPhase === MELODY_RECORDING_PHASES.COUNT_IN
    || recordingPhase === MELODY_RECORDING_PHASES.RECORDING;
  const sequenceCaptureActive = recordingPhase === MELODY_RECORDING_PHASES.SEQUENCE_CAPTURE;
  const recordButtonActive = recordingActive || sequenceCaptureActive;
  const scaleChangeLocked = recordingActive || [
    MELODY_RECORDING_PHASES.CONFIRM,
    MELODY_RECORDING_PHASES.SEQUENCE_CAPTURE,
  ].includes(recordingPhase);
  const workflowLocked = recordingActive
    || scaleChangeLocked
    || sequenceCaptureActive;
  const activeRhythmRecordingStep = recordingPhase === MELODY_RECORDING_PHASES.STEP_EDIT
    ? melodyRecordingState?.selectedStep ?? null
    : sequenceCaptureActive
      ? activeRhythmTemplate?.steps[melodyRecordingState?.barRecordedNotes] ?? null
      : null;
  const melodyInputStatus = (() => {
    if (!activeRhythmTemplate) return null;
    if (recordingPhase === MELODY_RECORDING_PHASES.STEP_EDIT) {
      return `Step ${(melodyRecordingState?.selectedStep ?? 0) + 1} · 请选择音高`;
    }
    if (sequenceCaptureActive) {
      return [
        `总音符 ${melodyRecordingState?.recordedNotes ?? 0}/${melodyRecordingState?.totalNotes ?? 0}`,
        `小节 ${writeBarProgress}/${melodyRecordingState?.totalBars ?? 0}`,
      ].join(' · ');
    }
    if (recordingPhase === MELODY_RECORDING_PHASES.CONFIRM) return '确认重写 · 原旋律仍然保留';
    if (recordingPhase === MELODY_RECORDING_PHASES.OVERVIEW) {
      return '自由弹奏 · 不会写入；点击写入开始收集';
    }
    return null;
  })();
  const activeScaleNoteIds = useMemo(
    () => new Set(getMelodyScaleNoteIds(melodyScaleId)),
    [melodyScaleId],
  );
  const highlightedStepIds = useMemo(
    () => new Set(activeRhythmTemplate?.steps ?? []),
    [activeRhythmTemplate],
  );
  const melodyInputGrid = useMemo(
    () => getMelodyInputGrid(melodyScaleId),
    [melodyScaleId],
  );
  const activePlayedNotes = useMemo(
    () => new Set(activeInputNotes),
    [activeInputNotes],
  );

  const handlePreviewStart = (event, cell) => {
    if (!cell.enabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onMelodyNoteOn({
      inputId: getVirtualMelodyInputId(cell.rowIndex, cell.column, event.pointerId),
      inputTimestampMs: event.timeStamp,
      note: cell.note,
      source: MELODY_INPUT_SOURCES.VIRTUAL,
    });
  };
  const handlePreviewEnd = (event, cell) => {
    onMelodyNoteOff({
      inputId: getVirtualMelodyInputId(cell.rowIndex, cell.column, event.pointerId),
      note: cell.note ?? undefined,
    });
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const handleClose = () => {
    closePicker();
    onClose();
  };
  const resetTimbreAction = () => {
    timbreRequestIdRef.current += 1;
    onMelodyPreviewStop();
    setTimbreActionState('idle');
  };
  const handleStyleSelect = (templateId) => {
    const template = getMelodyStyleTemplate(templateId);
    if (!template) return;
    resetTimbreAction();
    setSelectedStyleTemplateId(template.id);
    setSelectedTimbreId(template.recommendedTimbreId);
  };
  const handleTimbreSelect = (timbreId) => {
    resetTimbreAction();
    setSelectedTimbreId(timbreId);
  };
  const handleCurrentCombinationPreview = async () => {
    if (!selectedStyleTemplate || !selectedTimbre) return;
    const requestId = ++timbreRequestIdRef.current;
    onMelodyPreviewStop();
    setTimbreActionState('preview-loading');
    const played = await onMelodyPreview(
      getMelodyScalePreviewNotes(selectedStyleTemplate.id),
      { timbreId: selectedTimbre.id },
    );
    if (requestId !== timbreRequestIdRef.current) return;
    setTimbreActionState(played === false ? 'error' : 'idle');
  };
  const handleStyleApply = async () => {
    if (!selectedStyleTemplate || !selectedTimbre) return;
    const requestId = ++timbreRequestIdRef.current;
    onMelodyPreviewStop();
    setTimbreActionState('apply-loading');
    const prepared = await onMelodyTimbrePrepare(selectedTimbre.id);
    if (requestId !== timbreRequestIdRef.current) return;
    if (!prepared) {
      setTimbreActionState('error');
      return;
    }
    const applied = await onMelodyStyleTemplateApply(
      selectedStyleTemplate.id,
      selectedTimbre.id,
    );
    if (requestId !== timbreRequestIdRef.current) return;
    if (applied === false) {
      setTimbreActionState('error');
      return;
    }
    closePicker();
  };

  return (
    <section
      className="editor"
      data-screen-label="Melody Editor"
      data-picker={pickerMode ?? undefined}
    >
      <header className="editor-head">
        <div className="editor-left">
          {createElement(EditorTrackIdentity, { trackId: 'melody', label: trackName })}
          <div className="clip-title">
            <div className="crumb">Melody · Phrase</div>
            {createElement(ClipNameInput, { clipName, onRenameClip })}
            <div className="clip-name-meta">
              <span>
                MELODY EDITOR - BAR
                {' '}
                {selectedBar + 1}
                {' · '}
                {activeScale.label}
              </span>
              {melodyInputStatus ? (
                <span
                  className="melody-input-status-inline"
                  role="status"
                  aria-live="polite"
                >
                  {melodyInputStatus}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="tools">
          <button
            className={[
              'btn-template-groove',
              activeRhythmTemplate ? 'btn-template-groove-active' : '',
              styleButtonRole === 'target' ? 'tutorial-control-target' : '',
            ].filter(Boolean).join(' ')}
            ref={styleTriggerRef}
            aria-label="选择 Melody 风格模板"
            aria-expanded={pickerMode === 'style'}
            aria-haspopup="dialog"
            aria-disabled={styleButtonDisabled || workflowLocked}
            data-tutorial-role={styleButtonRole ?? undefined}
            type="button"
            disabled={styleButtonDisabled || workflowLocked}
            onClick={() => {
              resetTimbreAction();
              setSelectedStyleTemplateId(melodyRhythmTemplateId ?? melodyScaleId);
              setSelectedTimbreId(melodyTimbreId);
              setPickerMode((mode) => (mode === 'style' ? null : 'style'));
            }}
          >
            {renderIcon(SlidersHorizontal)}
            {activeRhythmTemplate
              ? `${activeRhythmTemplate.name} · ${activeTimbre.label.split(' · ')[0]}`
              : `Melody 风格 · ${activeTimbre.label.split(' · ')[0]}`}
          </button>
          <button
            className={[
              'btn-template',
              'melody-record-button',
              recordButtonActive ? 'recording' : '',
            ].filter(Boolean).join(' ')}
            aria-label={recordButtonActive ? '控制旋律写入' : '开始旋律写入'}
            type="button"
            disabled={tutorialLocked}
            onClick={onMelodyWriteToggle}
          >
            {recordingPhase === MELODY_RECORDING_PHASES.COUNT_IN
              ? `预拍 ${melodyRecordingState.countInBeat}`
              : recordingPhase === MELODY_RECORDING_PHASES.RECORDING
                ? `写入中 ${writeBarProgress}/${melodyRecordingState?.totalBars ?? 0}`
                : recordingPhase === MELODY_RECORDING_PHASES.SEQUENCE_CAPTURE
                    ? `取消 ${melodyRecordingState.recordedNotes}/${melodyRecordingState.totalNotes}`
                    : recordingPhase === MELODY_RECORDING_PHASES.CONFIRM
                      ? '确认重写'
                      : '写入'}
          </button>
          <button className="btn-template drum-clear-action" type="button" disabled={tutorialLocked} onClick={onClearMelodyBar}>
            清空本小节
          </button>
          <button className="btn-template drum-clear-action" type="button" disabled={tutorialLocked} onClick={onClearMelody}>
            清空整轨
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

      {createElement(TrackBarPager, {
        canPageBars,
        className: 'melody-editor-pager-shell',
        contentClassName: [
          'melody-editor-scroll',
          melodyInputVisible ? 'has-input-dock' : '',
        ].filter(Boolean).join(' '),
        onNextBar,
        onPreviousBar,
        trackId,
      }, (
        <>
        {melodyInputVisible ? (
        <div className="keyboard-strip" role="group" aria-label="QWERTY、网页与 Launchpad 音阶对应关系">
          <div className="ks-keys" data-scale={activeScale.id} aria-label="三八度按键与音符对应表">
            {melodyInputGrid.map((row) => (
              <div className="ks-row" key={row[0].rowId}>
                <span className="ks-octave" aria-hidden="true">{row[0].octave}</span>
                {row.map((cell) => {
                  const { name, octave } = formatMelodyNoteParts(cell.note ?? '');
                  const playing = cell.note ? activePlayedNotes.has(cell.note) : false;
                  return (
                    <button
                      className={[
                        'ks-key',
                        cell.enabled ? 'scale-tone' : 'disabled',
                        playing ? 'playing' : '',
                      ].filter(Boolean).join(' ')}
                      type="button"
                      data-key={cell.keyLabel}
                      data-note={cell.note ?? ''}
                      data-oct={octave}
                      disabled={!cell.enabled}
                      key={`${cell.rowId}-${cell.column}`}
                      aria-label={cell.enabled ? `${cell.note} - 按 ${cell.keyLabel}` : `${cell.keyLabel} - 当前音阶未使用`}
                      onPointerCancel={(event) => handlePreviewEnd(event, cell)}
                      onPointerDown={(event) => handlePreviewStart(event, cell)}
                      onPointerUp={(event) => handlePreviewEnd(event, cell)}
                    >
                      <span className="ks-letter">{cell.keyLabel}</span>
                      <span className="ks-divider" aria-hidden="true">·</span>
                      <span className="ks-note">
                        {cell.enabled ? name : '—'}
                        {cell.enabled ? <span className="oct">{octave}</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        ) : null}

        {exampleKeysTarget ? (
          <div
            className={[
              'melody-example-keys',
              exampleKeysRole === 'target' ? 'tutorial-control-target' : '',
            ].filter(Boolean).join(' ')}
            aria-label={`示例乐句 ${exampleKeysLabel}`}
            data-tutorial-role={exampleKeysRole ?? undefined}
          >
            {exampleKeysLabel.split('').map((character, index) => (
              character === ' ' ? (
                <span className="melody-example-gap" aria-hidden="true" key={`gap-${index}`} />
              ) : (
                <span className="melody-example-key" key={`${character}-${index}`}>
                  {character}
                </span>
              )
            ))}
          </div>
        ) : null}

        {createElement(PianoRoll, {
          activeHighlightedStep: activeRhythmRecordingStep,
          activeNoteIds: activePlayedNotes,
          ariaLabel: 'Melody piano roll',
          autoRevealActiveNote: true,
          disabled: tutorialLocked,
          getCellRenderState: (step, note) => (
            getMelodyCellRenderState(matrix, selectedBar, step, note)
          ),
          highlightedNoteIds: activeScaleNoteIds,
          highlightedStepIds,
          initialTopNote: 'B4',
          isCellActive: (step, note) => (
            isMelodyCellActive(matrix, selectedBar, step, note)
          ),
          notes: MELODY_NOTES,
          onCellPressEnd: recordingActive
            ? (_step, note) => onMelodyNoteOff({ inputId: `virtual:piano-roll:${note}`, note })
            : undefined,
          onCellPressStart: recordingActive
            ? (_step, note, event) => onMelodyNoteOn({
              inputId: `virtual:piano-roll:${note}`,
              inputTimestampMs: event.timeStamp,
              note,
              source: MELODY_INPUT_SOURCES.VIRTUAL,
            })
            : undefined,
          onCellToggle: onMelodyStepToggle,
          trackId,
        })}
        </>
      ))}

      {recordingPhase === MELODY_RECORDING_PHASES.COUNT_IN ? (
        <div className="melody-record-count-in" role="status" aria-live="assertive">
          <span>预拍</span>
          <strong>{melodyRecordingState.countInBeat}</strong>
        </div>
      ) : null}

      <section
        className="scale-picker melody-scale-workspace"
        ref={stylePickerRef}
        aria-labelledby="melodyStyleWorkspaceTitle"
        aria-modal="true"
        data-screen-label="Melody Style Picker"
        hidden={pickerMode !== 'style'}
        role="dialog"
      >
        <div className="melody-scale-workspace-panel">
          <header className="melody-scale-workspace-head">
            <div>
              <h2 id="melodyStyleWorkspaceTitle">Melody 风格与音色</h2>
              <span>
                {Object.keys(MELODY_SCALES).length} 个风格 · {Object.keys(MELODY_TIMBRES).length} 个音色
              </span>
            </div>
            <button
              className="melody-scale-workspace-icon-button close"
              aria-label="关闭二级菜单"
              title="关闭二级菜单"
              type="button"
              onClick={() => setPickerMode(null)}
            >
              {renderIcon(X)}
            </button>
          </header>

          <div className="melody-scale-workspace-body">
            <div className="melody-scale-workspace-label">
              <strong>选择旋律风格</strong>
              <span>STYLE + TIMBRE</span>
              <p>选择音阶、律动与推荐音色。也可以保留 Piano，设置会应用到整条 Melody 轨。</p>
            </div>

            <div className="melody-scale-options" id="styleList" aria-label="选择 Melody 风格模板">
              {Object.values(MELODY_SCALES).map((styleTemplate) => {
                const styleCardRole = getTutorialControlRole(
                  tutorialTargets,
                  `melody-style-card:${styleTemplate.id}`,
                );
                const styleCardDisabled = tutorialLocked && styleCardRole !== 'target';
                const selected = styleTemplate.id === selectedStyleTemplateId;

                return (
                  <article
                    className={[
                      'sctpl-card',
                      'melody-scale-card',
                      selected ? 'selected' : '',
                      styleCardRole === 'target' ? 'tutorial-control-target' : '',
                    ].filter(Boolean).join(' ')}
                    aria-disabled={styleCardDisabled}
                    data-scale={styleTemplate.id}
                    data-tutorial-role={styleCardRole ?? undefined}
                    key={styleTemplate.id}
                  >
                    <button
                      className="melody-scale-card-select"
                      aria-label={`选择${styleTemplate.label}风格模板`}
                      aria-pressed={selected}
                      disabled={styleCardDisabled}
                      type="button"
                      onClick={() => handleStyleSelect(styleTemplate.id)}
                    >
                      <span className="sctpl-name-row">
                        <strong className="sctpl-name">{styleTemplate.label}</strong>
                        {styleTemplate.tag ? <span className="sctpl-default-tag">{styleTemplate.tag}</span> : null}
                      </span>
                      <span className="sctpl-notes" aria-label="音阶包含的音符">
                        {MELODY_PITCH_CLASSES.map((pitchClass) => {
                          const scaleTone = isMelodyScalePitchClass(styleTemplate.id, pitchClass);
                          return (
                            <span
                              className={[
                                'sctpl-note',
                                scaleTone ? 'scale-tone' : '',
                              ].filter(Boolean).join(' ')}
                              key={`${styleTemplate.id}-${pitchClass}`}
                            >
                              {pitchClass}
                            </span>
                          );
                        })}
                      </span>
                      <span className="chord-template-mini-groove melody-style-mini-groove" aria-label={`律动位置 ${styleTemplate.rhythmSteps.map((step) => step + 1).join('、')}`}>
                        {renderMelodyMiniGroove(styleTemplate)}
                      </span>
                      <span className="sctpl-desc">{styleTemplate.description}</span>
                    </button>
                    <div className="sctpl-foot">
                      <span className="sctpl-foot-label">
                        {styleTemplate.footLabel}
                        {' · 推荐 '}
                        {getMelodyTimbre(styleTemplate.recommendedTimbreId).label.split(' · ')[0]}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>

            <section className="melody-timbre-section" aria-labelledby="melodyTimbreTitle">
              <div className="melody-timbre-section-label">
                <strong id="melodyTimbreTitle">选择音色</strong>
                <span>音色与风格可以自由组合</span>
              </div>
              <div className="melody-timbre-options" role="group" aria-label="选择 Melody 音色">
                {Object.values(MELODY_TIMBRES).map((timbre) => {
                  const selected = timbre.id === selectedTimbre.id;
                  const recommended = timbre.id === selectedStyleTemplate?.recommendedTimbreId;
                  return (
                    <button
                      className={[
                        'melody-timbre-card',
                        selected ? 'selected' : '',
                      ].filter(Boolean).join(' ')}
                      aria-pressed={selected}
                      disabled={tutorialLocked || timbreActionState.endsWith('loading')}
                      key={timbre.id}
                      type="button"
                      onClick={() => handleTimbreSelect(timbre.id)}
                    >
                      <span className="melody-timbre-name-row">
                        <strong>{timbre.label}</strong>
                        {recommended ? <span>模板推荐</span> : timbre.tag ? <span>{timbre.tag}</span> : null}
                      </span>
                      <small>{timbre.detail}</small>
                    </button>
                  );
                })}
              </div>
            </section>
            <div className="melody-style-actions">
              {timbreActionState === 'error' ? (
                <span className="melody-timbre-error visible" role="status" aria-live="polite">
                  音色加载失败，请重试或选择 Piano。
                </span>
              ) : <span className="melody-timbre-error" aria-hidden="true" />}
              <button
                className="melody-style-preview-action"
                disabled={
                  tutorialLocked
                  || !selectedStyleTemplate
                  || timbreActionState.endsWith('loading')
                }
                type="button"
                onClick={handleCurrentCombinationPreview}
              >
                {timbreActionState === 'preview-loading' ? '加载音色…' : '试听当前组合'}
              </button>
              <button
                className={[
                  'primary',
                  getTutorialControlRole(tutorialTargets, 'melody-style-apply-global') === 'target'
                    ? 'tutorial-control-target'
                    : '',
                ].filter(Boolean).join(' ')}
                aria-disabled={!selectedStyleTemplate || timbreActionState.endsWith('loading')}
                data-tutorial-role={getTutorialControlRole(
                  tutorialTargets,
                  'melody-style-apply-global',
                ) ?? undefined}
                disabled={!selectedStyleTemplate || timbreActionState.endsWith('loading') || (
                  tutorialLocked
                  && getTutorialControlRole(tutorialTargets, 'melody-style-apply-global') !== 'target'
                )}
                type="button"
                onClick={handleStyleApply}
              >
                {timbreActionState === 'apply-loading' ? '加载并应用…' : '应用到全局'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {recordingPhase === MELODY_RECORDING_PHASES.CONFIRM ? (
        <div className="melody-record-confirm-overlay" role="presentation">
          <section
            className="melody-record-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="melodyRecordConfirmTitle"
          >
            <span>MELODY WRITE</span>
            <h2 id="melodyRecordConfirmTitle">
              是否覆盖第 {melodyRecordingState.startBar + 1}–{melodyRecordingState.endBar + 1} 小节已有旋律？
            </h2>
            <p>
              {melodyRecordingState.mode === 'template'
                ? '每个小节会在收集完整一组音符后才原子覆盖；提前停止会保留当前未完成和未来小节。'
                : '自由写入只会在播放到每个小节时覆盖；提前停止会保留尚未到达的小节。'}
            </p>
            <div>
              <button type="button" onClick={onMelodyRecordCancel}>取消</button>
              <button className="primary" type="button" onClick={onMelodyRecordConfirm}>
                覆盖并开始写入
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export { MelodyEditor };
