import {
  useRef,
  useState,
} from 'react';
import {
  ArrowLeft,
  Check,
  FileImage,
  Film,
  RefreshCw,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  MULTIMODAL_ACCEPT,
  MULTIMODAL_ANALYSIS_STAGES,
  MULTIMODAL_RECOMMENDATION,
} from '../multimodalRecommendation.js';
import { BpmControl } from './BpmControl.jsx';
import { HardwareFlowShell } from './HardwareFlowShell.jsx';
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
}) {
  const [failedPreviewUrl, setFailedPreviewUrl] = useState(null);
  const videoUnavailable = failedPreviewUrl === previewUrl;

  if (!file || !previewUrl) return null;

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
            <span>浏览器无法预览这个视频，但仍可以继续生成推荐。</span>
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

function UploadView({
  error,
  file,
  kind,
  onBack,
  onFileSelect,
  onGenerate,
  previewUrl,
}) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const pickFile = (fileList) => {
    const nextFile = fileList?.[0] ?? null;
    if (nextFile) onFileSelect(nextFile);
  };

  return (
    <div className="multimodal-content upload-view">
      <div
        className="multimodal-dropzone"
        data-drag-active={dragActive ? 'true' : undefined}
        data-has-file={file ? 'true' : undefined}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) return;
          setDragActive(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          pickFile(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept={MULTIMODAL_ACCEPT}
          aria-label="上传图片或视频"
          onChange={(event) => {
            pickFile(event.target.files);
            event.target.value = '';
          }}
        />

        {file ? (
          <div className="multimodal-upload-preview">
            <div className="multimodal-preview-frame">
              <MediaPreview file={file} kind={kind} previewUrl={previewUrl} />
            </div>
            <div className="multimodal-file-meta">
              <span aria-hidden="true">{renderIcon(kind === 'image' ? FileImage : Film)}</span>
              <span>
                <strong>{file.name}</strong>
                <small>{kind === 'image' ? 'IMAGE INPUT' : 'VIDEO INPUT'}</small>
              </span>
            </div>
          </div>
        ) : (
          <div className="multimodal-empty-upload">
            <span className="multimodal-upload-icon" aria-hidden="true">{renderIcon(Upload)}</span>
            <strong>放入一张图片或一段视频</strong>
            <span>我们会从色彩、场景和动态中推荐编曲方向</span>
            <small>JPEG / PNG / WebP / GIF · MP4 / WebM / MOV</small>
          </div>
        )}

        <button
          className="hardware-flow-button secondary"
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          {file ? '更换素材' : '选择本地素材'}
        </button>
      </div>

      {error ? <p className="multimodal-error" role="alert">{error}</p> : null}

      <div className="multimodal-actions">
        <button className="hardware-flow-button ghost" type="button" onClick={onBack}>
          <span aria-hidden="true">{renderIcon(ArrowLeft)}</span>
          返回曲风
        </button>
        <button
          className="hardware-flow-button primary"
          type="button"
          disabled={!file}
          onClick={onGenerate}
        >
          <span aria-hidden="true">{renderIcon(Sparkles)}</span>
          生成编曲建议
        </button>
      </div>
    </div>
  );
}

function AnalyzingView({
  file,
  kind,
  onCancel,
  previewUrl,
  stageIndex,
}) {
  return (
    <div className="multimodal-content analyzing-view">
      <div className="analysis-media-panel" aria-hidden="true">
        <MediaPreview file={file} kind={kind} previewUrl={previewUrl} />
        <span className="analysis-scan-line" />
      </div>
      <div className="analysis-status-panel" role="status" aria-live="polite">
        <span className="analysis-orb" aria-hidden="true">{renderIcon(Sparkles)}</span>
        <p className="analysis-kicker mono">MULTIMODAL ANALYSIS</p>
        <h2>{MULTIMODAL_ANALYSIS_STAGES[stageIndex]}</h2>
        <ol className="analysis-stage-list">
          {MULTIMODAL_ANALYSIS_STAGES.map((stage, index) => (
            <li
              data-state={index < stageIndex ? 'complete' : index === stageIndex ? 'active' : 'pending'}
              key={stage}
            >
              <span className="analysis-stage-mark" aria-hidden="true">
                {index < stageIndex ? renderIcon(Check) : index + 1}
              </span>
              <span>{stage}</span>
            </li>
          ))}
        </ol>
        <div className="analysis-progress" aria-hidden="true">
          <span style={{ width: `${((stageIndex + 1) / MULTIMODAL_ANALYSIS_STAGES.length) * 100}%` }} />
        </div>
        <button className="hardware-flow-button ghost" type="button" onClick={onCancel}>
          取消分析
        </button>
      </div>
    </div>
  );
}

function TrackRecommendationPicker({
  activeTrackId,
  onTimbreChange,
  onTrackFocus,
  onTrackToggle,
  selectedTrackIds,
  timbreByTrackId,
}) {
  const primaryTracks = MULTIMODAL_RECOMMENDATION.tracks.slice(0, 4);
  const activeTrack = primaryTracks.find(
    (track) => track.id === activeTrackId,
  ) ?? primaryTracks[0];
  const activeTimbreId = timbreByTrackId[activeTrack.id] ?? activeTrack.timbres[0].id;

  return (
    <div className="track-recommendation compact-results-tracks">
      <div className="track-recommendation-list" role="list" aria-label="乐器搭配">
        {primaryTracks.map((track) => {
          const Icon = TRACK_ICONS[track.id];
          const selected = selectedTrackIds.includes(track.id);
          const active = track.id === activeTrack.id;
          const selectedTimbre = track.timbres.find(
            (timbre) => timbre.id === timbreByTrackId[track.id],
          ) ?? track.timbres[0];
          const trackLabel = getTrackRecommendationLabel(track);

          return (
            <div
              className="track-recommendation-row"
              data-active={active ? 'true' : undefined}
              data-selected={selected ? 'true' : undefined}
              data-track={track.id}
              key={track.id}
              role="listitem"
            >
              <button
                className="track-recommendation-toggle"
                type="button"
                aria-label={`${selected ? '取消' : '选择'}${trackLabel}`}
                aria-pressed={selected}
                disabled={selected && selectedTrackIds.length === 1}
                onClick={() => onTrackToggle(track.id)}
              >
                {renderIcon(Check)}
              </button>
              <span className="track-recommendation-icon" aria-hidden="true">
                {renderIcon(Icon)}
              </span>
              <span className="track-recommendation-copy">
                <strong>{trackLabel}</strong>
                <small>{getTrackTimbreLabel(track, selectedTimbre)}</small>
              </span>
              <button
                className="track-recommendation-change"
                type="button"
                aria-pressed={active}
                aria-label={`${trackLabel}音色`}
                onClick={() => onTrackFocus(track.id)}
              >
                音色
              </button>
            </div>
          );
        })}
      </div>

      <div className="track-timbre-detail" data-track={activeTrack.id}>
        <div
          className="track-timbre-options"
          role="radiogroup"
          aria-label={`${getTrackRecommendationLabel(activeTrack)}音色`}
        >
          {activeTrack.timbres.map((timbre, index) => (
            <button
              className="track-timbre-option"
              data-active={timbre.id === activeTimbreId ? 'true' : undefined}
              key={timbre.id}
              type="button"
              role="radio"
              aria-checked={timbre.id === activeTimbreId}
              onClick={() => onTimbreChange(activeTrack.id, timbre.id)}
            >
              <span>{getTrackTimbreLabel(activeTrack, timbre)}</span>
              {index === 0 ? <small>推荐</small> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultsView({
  bpm,
  file,
  kind,
  onApply,
  onBack,
  onBpmChange,
  onRecommendationTimbreChange,
  onRecommendationTrackFocus,
  onRecommendationTrackToggle,
  previewUrl,
  selections,
}) {
  return (
    <div className="multimodal-content results-view results-copy-only">
      <section className="results-copy-overview">
        <div className="results-copy-media">
          <MediaPreview
            file={file}
            kind={kind}
            previewUrl={previewUrl}
            showFallbackCopy={false}
          />
        </div>

        <div className="results-copy-descriptions">
          <article>
            <h2>画面描述</h2>
            <p>地面略微潮湿，刚下过雨，几个滑板青年悠闲地在街头漫步，穿着打扮符合日式街头潮流</p>
          </article>
          <article>
            <h2>曲风描述</h2>
            <p>整体应接近City Pop质感，音色听起来温暖、柔和；节奏中速偏慢，听起来悠闲舒缓的同时有较强的律动感，符合图中人物穿着的潮流感和街头感；旋律应偏向轻松明亮，同时有一定都市霓虹的现代感</p>
          </article>
        </div>

        <button
          className="results-icon-action results-change-source"
          type="button"
          aria-label="返回上传画面"
          onClick={onBack}
        >
          <span aria-hidden="true">{renderIcon(RefreshCw)}</span>
        </button>
      </section>

      <section className="results-advice-grid" aria-labelledby="results-advice-title">
        <h2 className="sr-only" id="results-advice-title">AI音乐风格建议</h2>

        <article className="results-advice-card results-tempo-card">
          <h3>速度和节奏</h3>
          <div className="results-tempo-line">
            <strong>中速偏慢 |</strong>
            <BpmControl
              idPrefix="recommendation-bpm"
              unit="bpm"
              value={bpm}
              onChange={onBpmChange}
            />
          </div>
          <p>4/4拍，节奏设计密集且律动感强</p>
        </article>

        <article className="results-advice-card results-instrument-card">
          <h3>乐器搭配</h3>
          <TrackRecommendationPicker
            activeTrackId={selections.activeTrackId}
            onTimbreChange={onRecommendationTimbreChange}
            onTrackFocus={onRecommendationTrackFocus}
            onTrackToggle={onRecommendationTrackToggle}
            selectedTrackIds={selections.selectedTrackIds}
            timbreByTrackId={selections.timbreByTrackId}
          />
        </article>

        <article className="results-advice-card results-harmony-card">
          <h3>旋律和声</h3>
          <p>C大调，流行音乐最常用的Doo-Wop和弦进行，听感和谐流畅；配合七和弦增加听觉色彩和张力</p>
          <strong>Cmaj7 - Am7 - Fmaj7 - G7</strong>
        </article>

        <button
          className="results-icon-action apply-recommendation"
          type="button"
          aria-label="进入编曲界面"
          onClick={onApply}
        >
          <span aria-hidden="true">{renderIcon(Sparkles)}</span>
        </button>
      </section>
    </div>
  );
}

function MultimodalFlowScreen({
  bpm,
  error,
  file,
  kind,
  onApply,
  onBack,
  onBpmChange,
  onCancelAnalysis,
  onFileSelect,
  onGenerate,
  onRecommendationTimbreChange,
  onRecommendationTrackFocus,
  onRecommendationTrackToggle,
  previewUrl,
  selections,
  stageIndex,
  view,
}) {
  const viewMeta = {
    upload: {
      kicker: 'AI MULTIMODAL INPUT',
      title: '上传画面',
    },
    analyzing: {
      kicker: 'AI MULTIMODAL ENGINE',
      title: '正在理解画面',
    },
    results: {
      kicker: '',
      title: 'AI音乐风格建议',
    },
  }[view];

  return (
    <HardwareFlowShell
      ariaLabel="AI 多模态编曲"
      consoleTitle="AETHER SYNTHESIZERS - MULTIMODAL ARRANGER"
      kicker={viewMeta.kicker}
      screenClassName={`multimodal-screen ${view}-screen`}
      title={viewMeta.title}
    >
      {view === 'upload' ? (
        <UploadView
          error={error}
          file={file}
          kind={kind}
          onBack={onBack}
          onFileSelect={onFileSelect}
          onGenerate={onGenerate}
          previewUrl={previewUrl}
        />
      ) : null}
      {view === 'analyzing' ? (
        <AnalyzingView
          file={file}
          kind={kind}
          onCancel={onCancelAnalysis}
          previewUrl={previewUrl}
          stageIndex={stageIndex}
        />
      ) : null}
      {view === 'results' ? (
        <ResultsView
          bpm={bpm}
          file={file}
          kind={kind}
          onApply={onApply}
          onBack={onBack}
          onBpmChange={onBpmChange}
          onRecommendationTimbreChange={onRecommendationTimbreChange}
          onRecommendationTrackFocus={onRecommendationTrackFocus}
          onRecommendationTrackToggle={onRecommendationTrackToggle}
          previewUrl={previewUrl}
          selections={selections}
        />
      ) : null}
    </HardwareFlowShell>
  );
}

// JSX component references are not marked as reads by this repository's lint parser.
void BpmControl;
void HardwareFlowShell;
void MediaPreview;
void UploadView;
void AnalyzingView;
void TrackRecommendationPicker;
void ResultsView;

export { MultimodalFlowScreen };
