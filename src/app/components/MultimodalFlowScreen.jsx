import {
  useRef,
  useState,
} from 'react';
import {
  Check,
  FileImage,
  Film,
  Sparkles,
  Upload,
  AudioLines,
  Text,
} from 'lucide-react';
import {
  MULTIMODAL_RECOMMENDATION,
} from '../multimodalRecommendation.js';
import { MULTIMODAL_INPUT_MODES, MULTIMODAL_TEXT_LIMIT, getMultimodalAnalysisStages, validateMultimodalInput } from '../multimodalInput.js';
import { EntryShell } from './EntryShell.jsx';
import { BpmControl } from './BpmControl.jsx';
import { TRACK_ICONS, renderIcon } from './icons.js';

const TRACK_RECOMMENDATION_COPY = Object.freeze({
  drums: Object.freeze({
    label: '鼓',
    timbres: Object.freeze({
      'soft-electronic-kit': '柔和电子鼓',
      'dusty-tape-kit': '复古磁带鼓',
      'clean-digital-kit': '清晰数码鼓',
    }),
  }),
  chord: Object.freeze({
    label: '和弦',
    timbres: Object.freeze({
      'warm-electric-piano': '温暖电钢琴',
      'muted-rhodes': '柔和罗兹电钢琴',
      'glass-electric-keys': '透亮电钢琴',
    }),
  }),
  bass: Object.freeze({
    label: '低音',
    timbres: Object.freeze({
      'round-electric-bass': '圆润电贝司',
      'soft-sub-bass': '柔和次低音',
      'fm-round-bass': 'FM 圆润贝司',
    }),
  }),
  melody: Object.freeze({
    label: '旋律',
    timbres: Object.freeze({
      'airy-synth-lead': '空气感合成器',
      'hazy-bell-lead': '朦胧铃音主奏',
      'soft-pluck-lead': '柔和拨弦主奏',
    }),
  }),
});

function getTrackRecommendationLabel(track) {
  return TRACK_RECOMMENDATION_COPY[track.id]?.label ?? track.label;
}

function getTrackTimbreLabel(track, timbre) {
  return TRACK_RECOMMENDATION_COPY[track.id]?.timbres?.[timbre.id] ?? timbre.label;
}

function MediaPreview({
  file,
  kind,
  previewUrl,
  showFallbackCopy = true,
  textPrompt = '',
}) {
  const [failedPreviewUrl, setFailedPreviewUrl] = useState(null);
  const videoUnavailable = failedPreviewUrl === previewUrl;

  if (kind === 'text') return <div className="multimodal-text-preview">{textPrompt}</div>;
  if (!file || !previewUrl) return null;
  if (kind === 'audio' && !videoUnavailable) {
    return <div className="multimodal-audio-preview">
      <audio src={previewUrl} aria-label={`已选择：${file.name}`} controls preload="metadata" onError={() => setFailedPreviewUrl(previewUrl)} />
    </div>;
  }

  if (kind === 'image') {
    return (
      <img
        className="multimodal-media"
        src={previewUrl}
        alt={`已选择：${file.name}`}
      />
    );
  }

  if (videoUnavailable) {
    return (
      <div className="multimodal-video-fallback" role="status">
        <span aria-hidden="true">{renderIcon(Film)}</span>
        {showFallbackCopy ? (
          <>
            <strong>{file.name}</strong>
            <span>{kind === 'audio' ? '浏览器无法预览这段音频，但仍可以继续生成推荐。' : '浏览器无法预览这个视频，但仍可以继续生成推荐。'}</span>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <video
      className="multimodal-media"
      src={previewUrl}
      aria-label={`已选择：${file.name}`}
      controls
      muted
      playsInline
      preload="metadata"
      onError={() => setFailedPreviewUrl(previewUrl)}
    />
  );
}

const INPUT_ICONS = { text: Text, audio: AudioLines, video: Film, image: FileImage };

function UploadView({ error, file, kind, inputMode, textPrompt, onInputModeChange, onTextPromptChange,
  onFileSelect, onGenerate, previewUrl }) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const mode = MULTIMODAL_INPUT_MODES.find((item) => item.id === inputMode);
  const valid = validateMultimodalInput({ mode: inputMode, text: textPrompt, file }).valid;
  const pickFile = (fileList) => {
    const nextFile = fileList?.[0];
    if (nextFile) onFileSelect(nextFile);
  };
  const changeMode = (id) => { setDragActive(false); onInputModeChange(id); };
  const handleTabKeyDown = (event, index) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % 4;
    else if (event.key === 'ArrowLeft') next = (index + 3) % 4;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 3;
    else return;
    event.preventDefault();
    changeMode(MULTIMODAL_INPUT_MODES[next].id);
    document.getElementById(`input-tab-${MULTIMODAL_INPUT_MODES[next].id}`)?.focus();
  };
  return <>
    <div className="entry-ai-heading">
      <h1>AI 创作</h1>
      <p>选择一种方式，输入你的灵感</p>
    </div>
    <div className="entry-mode-tabs" role="tablist" aria-label="输入方式">
      {MULTIMODAL_INPUT_MODES.map((item, index) => <button
        className="entry-mode-tab" key={item.id} type="button" role="tab"
        id={`input-tab-${item.id}`} aria-selected={inputMode === item.id}
        aria-controls={`input-panel-${item.id}`} tabIndex={inputMode === item.id ? 0 : -1}
        onClick={() => changeMode(item.id)} onKeyDown={(event) => handleTabKeyDown(event, index)}>
        <span aria-hidden="true">{renderIcon(INPUT_ICONS[item.id])}</span>{item.label}
      </button>)}
    </div>
    <div className="entry-input-panel" id={`input-panel-${inputMode}`} role="tabpanel" aria-labelledby={`input-tab-${inputMode}`}>
      {inputMode === 'text' ? <>
        <textarea className="entry-text-input" aria-label="音乐创作描述" aria-describedby="entry-text-hint"
          placeholder="描述你想要的音乐，例如：雨天散步，节奏舒缓，带一点温暖的钢琴。"
          value={textPrompt} maxLength={MULTIMODAL_TEXT_LIMIT} onChange={(event) => onTextPromptChange(event.target.value)}
          onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && valid) { event.preventDefault(); onGenerate(); } }} />
        <p className="entry-input-hint" id="entry-text-hint">最多 {MULTIMODAL_TEXT_LIMIT} 字 · ⌘ / Ctrl + Enter 生成</p>
      </> : <div className="entry-file-region" data-drag-active={dragActive ? 'true' : undefined}
        onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false); }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); setDragActive(false); pickFile(event.dataTransfer.files); }}>
        <input ref={inputRef} className="sr-only" type="file" accept={mode.accept} aria-label={`上传${mode.label}`}
          onChange={(event) => { pickFile(event.target.files); event.target.value = ''; }} />
        {file ? <div className="entry-file-selected">
          <div className={`entry-media-preview ${inputMode}`}>
            <MediaPreview file={file} kind={kind} previewUrl={previewUrl} />
          </div>
          <div className="entry-file-meta">
            <div className="entry-file-name"><span aria-hidden="true">{renderIcon(INPUT_ICONS[inputMode])}</span><span>{file.name}</span></div>
            <p className="entry-file-detail">{file.name.split('.').pop().toUpperCase()} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>
            <button className="entry-button" type="button" onClick={() => inputRef.current?.click()}>更换{mode.label}</button>
            <div className="entry-file-help"><span>支持 {mode.formats}</span><span>{mode.limit}</span></div>
          </div>
        </div> : <div className="entry-file-empty">
          <button className="entry-button primary" type="button" onClick={() => inputRef.current?.click()}>
            <span aria-hidden="true">{renderIcon(Upload)}</span>选择{mode.label}
          </button>
          <p>也可以将文件拖到这里</p>
          <div className="entry-file-help"><span>支持 {mode.formats}</span><span>{mode.limit}</span></div>
        </div>}
      </div>}
    </div>
    {error ? <p className="entry-error" role="alert">{error}</p> : null}
    {inputMode === 'text' || file ? <div className="entry-generate">
      <button className="entry-button primary" type="button" disabled={!valid} onClick={onGenerate}>生成编曲建议</button>
    </div> : null}
  </>;
}

function AnalyzingView({
  file,
  kind,
  onCancel,
  previewUrl,
  stageIndex,
  textPrompt,
}) {
  const analysisStages = getMultimodalAnalysisStages(kind);
  const modeLabel = MULTIMODAL_INPUT_MODES.find((mode) => mode.id === kind)?.label ?? '素材';
  const title = kind === 'text' ? '正在整理你的灵感' : kind === 'audio' ? '正在整理你的音频' : '正在理解你的画面';
  return <div className="entry-analysis-body">
    <div className="entry-analysis-heading">
      <span className="entry-analysis-kicker"><span aria-hidden="true">{renderIcon(Sparkles)}</span>AI 创作</span>
      <h1>{title}</h1>
      <p>从你的灵感出发，整理风格、节奏与配器建议</p>
    </div>
    <div className="entry-analysis-layout">
      <section className="entry-analysis-source" aria-label="本次输入">
        <div className="entry-analysis-source-heading">
          <h2>你的灵感</h2>
          <span><span aria-hidden="true">{renderIcon(INPUT_ICONS[kind] ?? FileImage)}</span>{modeLabel}输入</span>
        </div>
        <div className={`entry-analysis-preview ${kind}`}>
          <MediaPreview file={file} kind={kind} previewUrl={previewUrl} textPrompt={textPrompt} />
        </div>
        {file ? <p className="entry-analysis-source-detail"><span title={file.name}>{file.name}</span>
          <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span></p> : <p className="entry-analysis-source-detail">保留你的描述，找到合适的音乐方向</p>}
      </section>
      <section className="entry-analysis-status" aria-label="分析进度">
        <div className="entry-analysis-status-heading">
          <h2>编曲建议生成中</h2><span>步骤 {stageIndex + 1} / {analysisStages.length}</span>
        </div>
        <p className="entry-analysis-current" role="status" aria-live="polite" aria-atomic="true">{analysisStages[stageIndex]}</p>
        <ol className="entry-analysis-stages">
          {analysisStages.map((stage, index) => <li key={stage}
            data-state={index < stageIndex ? 'complete' : index === stageIndex ? 'active' : 'pending'}
            aria-current={index === stageIndex ? 'step' : undefined}>
            <span className="entry-analysis-stage-mark" aria-hidden="true">{index < stageIndex ? renderIcon(Check) : index + 1}</span>
            <span>{stage}</span>
            <small>{index < stageIndex ? '已完成' : index === stageIndex ? '进行中' : '待开始'}</small>
          </li>)}
        </ol>
        <div className="entry-analysis-actions">
          <span>演示编曲建议</span>
          <button className="entry-button" type="button" onClick={onCancel}>取消分析</button>
        </div>
      </section>
    </div>
  </div>;
}

function TrackRecommendationPicker({ onTrackToggle, selectedTrackIds, timbreByTrackId }) {
  const primaryTracks = MULTIMODAL_RECOMMENDATION.tracks.slice(0, 4);
  return <div className="entry-track-list" role="group" aria-label="乐器搭配">
    {primaryTracks.map((track) => {
      const selected = selectedTrackIds.includes(track.id);
      const timbre = track.timbres.find((item) => item.id === timbreByTrackId[track.id]) ?? track.timbres[0];
      const label = getTrackRecommendationLabel(track);
      return <button className="entry-track-choice" key={track.id} type="button" data-track={track.id}
        aria-label={`${selected ? '取消' : '选择'}${label}`} aria-pressed={selected}
        disabled={selected && selectedTrackIds.length === 1} onClick={() => onTrackToggle(track.id)}>
        <span className="entry-track-mark" aria-hidden="true">{selected ? renderIcon(Check) : null}</span>
        <span className="entry-track-icon" aria-hidden="true">{renderIcon(TRACK_ICONS[track.id])}</span>
        <strong>{label}</strong><small>{getTrackTimbreLabel(track, timbre)}</small>
      </button>;
    })}
  </div>;
}

function ResultsView({ bpm, file, kind, onApply, onBpmChange, onRecommendationTrackToggle, previewUrl, selections, textPrompt }) {
  return <div className="entry-results-body">
    <div className="entry-results-heading">
      <div><h1>AI音乐风格建议</h1><p>调整速度与配器，让灵感成为你的作品</p></div>
      <span className="entry-results-demo">演示编曲建议</span>
    </div>
    <section className="entry-results-overview" aria-label="素材与风格建议">
      <div className="entry-results-source">
        <div className={`entry-results-preview ${kind}`}>
          <MediaPreview file={file} kind={kind} previewUrl={previewUrl} showFallbackCopy={false} textPrompt={textPrompt} />
        </div>
        {file ? <p className="entry-results-filename" title={file.name}>{file.name}</p> : null}
      </div>
      <div className="entry-results-copy">
        <article>
          <h2>{kind === 'text' ? '文字描述' : kind === 'audio' ? '音频素材' : '画面描述'}</h2>
          <p>{kind === 'text' ? textPrompt : kind === 'audio' ? `已选择音频：${file?.name ?? ''}` : '地面略微潮湿，刚下过雨，几个滑板青年悠闲地在街头漫步，穿着打扮符合日式街头潮流'}</p>
        </article>
        <article>
          <h2>曲风描述</h2>
          <p>{kind === 'text' || kind === 'audio' ? '演示方案采用温暖、柔和的 City Pop 音色，中速偏慢的节奏搭配电钢琴、圆润低音与轻盈的合成器旋律。' : '整体应接近City Pop质感，音色听起来温暖、柔和；节奏中速偏慢，听起来悠闲舒缓的同时有较强的律动感，符合图中人物穿着的潮流感和街头感；旋律应偏向轻松明亮，同时有一定都市霓虹的现代感'}</p>
        </article>
      </div>
    </section>
    <div className="entry-results-settings">
      <section className="entry-results-tempo" aria-labelledby="entry-tempo-title">
        <h2 id="entry-tempo-title">速度和节奏</h2>
        <p className="entry-tempo-description">中速偏慢 <span aria-hidden="true">|</span> 4/4拍</p>
        <BpmControl idPrefix="recommendation-bpm" unit="bpm" value={bpm} onChange={onBpmChange} />
        <p className="entry-results-help">4/4拍，节奏设计密集且律动感强</p>
      </section>
      <section className="entry-results-instruments" aria-labelledby="entry-instruments-title">
        <div className="entry-instruments-heading"><h2 id="entry-instruments-title">乐器搭配</h2><span>点击选择 · 至少保留一条轨道</span></div>
        <TrackRecommendationPicker onTrackToggle={onRecommendationTrackToggle}
          selectedTrackIds={selections.selectedTrackIds} timbreByTrackId={selections.timbreByTrackId} />
      </section>
    </div>
    <div className="entry-results-actions">
      <button className="entry-button" type="button" onClick={() => onApply('jam')}>在演出模式继续</button>
      <button className="entry-button primary" type="button" onClick={() => onApply('creation')}>在创作模式继续</button>
    </div>
  </div>;
}

function MultimodalFlowScreen({
  bpm,
  error,
  file,
  kind,
  inputMode,
  textPrompt,
  onInputModeChange,
  onTextPromptChange,
  onApply,
  onBack,
  onBpmChange,
  onCancelAnalysis,
  onFileSelect,
  onGenerate,
  onRecommendationTrackToggle,
  previewUrl,
  selections,
  stageIndex,
  view,
}) {
  if (view === 'upload') return <EntryShell className={`entry-ai entry-ai-${inputMode}`} label="AI 多模态编曲" onBack={onBack}>
    <UploadView error={error} file={file} kind={kind} inputMode={inputMode} textPrompt={textPrompt}
      onInputModeChange={onInputModeChange} onTextPromptChange={onTextPromptChange}
      onFileSelect={onFileSelect} onGenerate={onGenerate} previewUrl={previewUrl} />
  </EntryShell>;

  if (view === 'results') return <EntryShell className="entry-results" label="AI 多模态编曲" onBack={onBack} backLabel="返回输入">
    <ResultsView bpm={bpm} file={file} kind={kind} onApply={onApply} onBpmChange={onBpmChange}
      onRecommendationTrackToggle={onRecommendationTrackToggle} previewUrl={previewUrl} selections={selections} textPrompt={textPrompt} />
  </EntryShell>;

  return <EntryShell className="entry-analysis" label="AI 多模态编曲" onBack={onCancelAnalysis} backLabel="返回输入">
    <AnalyzingView file={file} kind={kind} onCancel={onCancelAnalysis} previewUrl={previewUrl}
      stageIndex={stageIndex} textPrompt={textPrompt} />
  </EntryShell>;
}

// JSX component references are not marked as reads by this repository's lint parser.
void BpmControl;
void MediaPreview;
void UploadView;
void AnalyzingView;
void TrackRecommendationPicker;
void ResultsView;

export { MultimodalFlowScreen };

void EntryShell;
