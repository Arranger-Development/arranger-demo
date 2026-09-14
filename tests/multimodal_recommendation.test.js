import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  BPM_MAX,
  BPM_MIN,
  BPM_PRESETS,
  RECOMMENDED_BPM,
  normalizeBpm,
} from '../src/domain/bpm.js';
import {
  MULTIMODAL_ANALYSIS_STAGES,
  MULTIMODAL_RECOMMENDATION,
  createInitialRecommendationSelections,
  createMultimodalRecommendationAppState,
  selectRecommendationTrackTimbre,
  toggleRecommendationTrackSelection,
  validateMultimodalMediaFile,
} from '../src/app/multimodalRecommendation.js';
import {
  CORE_TRACK_IDS,
  STEPS_PER_BAR,
  TOTAL_BARS,
} from '../src/domain/musicConstants.js';
import {
  createChillTutorialMatrix,
  isChillTutorialScoreComplete,
} from '../src/tutorial/chillTutorialScore.js';

test('BPM controls normalize integer values into the supported project range', () => {
  assert.equal(BPM_MIN, 40);
  assert.equal(BPM_MAX, 240);
  assert.deepEqual(BPM_PRESETS, [76, 88, 96]);
  assert.equal(RECOMMENDED_BPM, 88);
  assert.equal(normalizeBpm(39), 40);
  assert.equal(normalizeBpm(240.6), 240);
  assert.equal(normalizeBpm(103.7), 104);
  assert.equal(normalizeBpm('96'), 96);
  assert.equal(normalizeBpm('not-a-number', 77), 77);
});

test('multimodal media validation accepts the approved image and video formats and limits', () => {
  assert.deepEqual(validateMultimodalMediaFile({
    name: 'rain.webp',
    size: 20 * 1024 * 1024,
    type: 'image/webp',
  }), {
    error: null,
    kind: 'image',
    valid: true,
  });
  assert.deepEqual(validateMultimodalMediaFile({
    name: 'street.mov',
    size: 200 * 1024 * 1024,
    type: '',
  }), {
    error: null,
    kind: 'video',
    valid: true,
  });
  assert.equal(validateMultimodalMediaFile({
    name: 'silent-export.webm',
    size: 12,
    type: '',
  }).valid, true);
  assert.equal(validateMultimodalMediaFile({
    name: 'camera-image.jpeg',
    size: 12,
    type: '',
  }).valid, true);
  assert.equal(validateMultimodalMediaFile({
    name: 'oversize.png',
    size: 20 * 1024 * 1024 + 1,
    type: 'image/png',
  }).valid, false);
  assert.equal(validateMultimodalMediaFile({
    name: 'notes.pdf',
    size: 100,
    type: 'application/pdf',
  }).valid, false);
});

test('fixed multimodal profile exposes analysis stages and six per-track timbre groups', () => {
  assert.deepEqual(MULTIMODAL_ANALYSIS_STAGES, [
    '读取画面构图与动态',
    '识别色彩、场景与情绪',
    '匹配调式、和声与配器',
  ]);
  assert.equal(MULTIMODAL_RECOMMENDATION.style.options[0].label, 'Chill 雨夜街头');
  assert.equal(MULTIMODAL_RECOMMENDATION.mode.options[0].label, 'C Major · Ionian');
  assert.equal(
    MULTIMODAL_RECOMMENDATION.harmony.options[0].label,
    'Cmaj7 → Am7 → Fmaj7 → G7',
  );
  assert.deepEqual(
    MULTIMODAL_RECOMMENDATION.tracks.map((track) => track.id),
    ['drums', 'chord', 'bass', 'melody', 'pad', 'sample'],
  );
  assert.deepEqual(
    MULTIMODAL_RECOMMENDATION.tracks.map((track) => track.timbres.length),
    [3, 3, 3, 3, 3, 3],
  );
  assert.deepEqual(
    MULTIMODAL_RECOMMENDATION.tracks.map((track) => track.timbres[0].label),
    [
      'Soft Electronic Kit',
      'Warm Electric Piano',
      'Round Electric Bass',
      'Airy Synth Lead',
      'Rain Glow Pad',
      'Rain Street Texture',
    ],
  );
});

test('recommendation selections keep four defaults and enforce at least one selected track', () => {
  const initial = createInitialRecommendationSelections();

  assert.equal(initial.activeTrackId, 'drums');
  assert.deepEqual(initial.selectedTrackIds, ['drums', 'chord', 'bass', 'melody']);
  assert.equal(initial.timbreByTrackId.drums, 'soft-electronic-kit');
  assert.equal(initial.timbreByTrackId.sample, 'rain-street-texture');

  assert.deepEqual(
    toggleRecommendationTrackSelection(initial.selectedTrackIds, 'pad'),
    ['drums', 'chord', 'bass', 'melody', 'pad'],
  );
  assert.deepEqual(
    toggleRecommendationTrackSelection(['drums'], 'drums'),
    ['drums'],
  );
  assert.deepEqual(
    toggleRecommendationTrackSelection(['drums', 'chord'], 'drums'),
    ['chord'],
  );
});

test('per-track timbre selection accepts only options owned by that track', () => {
  const initial = createInitialRecommendationSelections();
  const updated = selectRecommendationTrackTimbre(
    initial.timbreByTrackId,
    'pad',
    'glass-air-pad',
  );

  assert.equal(updated.pad, 'glass-air-pad');
  assert.equal(updated.drums, 'soft-electronic-kit');
  assert.equal(
    selectRecommendationTrackTimbre(updated, 'pad', 'soft-sub-bass'),
    updated,
  );
});

test('applying the recommendation loads the complete eight-bar Chill arrangement', () => {
  const state = createMultimodalRecommendationAppState({ bpm: 96 });
  const expectedMatrix = createChillTutorialMatrix();

  assert.equal(state.bpm, 96);
  assert.equal(state.rootKey, 'C');
  assert.equal(state.scale, 'Ionian');
  assert.equal(state.melodyScaleId, 'chinese');
  assert.equal(state.melodyRhythmTemplateId, null);
  assert.equal(state.melodyTimbreId, 'piano');
  assert.deepEqual(state.trackOrder, CORE_TRACK_IDS);
  assert.deepEqual(state.visibleTrackIds, CORE_TRACK_IDS);
  assert.equal(state.clips.ids.length, CORE_TRACK_IDS.length * TOTAL_BARS);
  assert.equal(state.activeTrackId, 'drums');
  assert.equal(state.selectedBar, 0);
  assert.equal(state.selectedClipId, 'drums-bar-0');
  assert.equal(state.currentBar, 0);
  assert.equal(state.currentStep, 0);
  assert.equal(state.isPlaying, false);
  assert.equal(isChillTutorialScoreComplete(state.matrix), true);

  CORE_TRACK_IDS.forEach((trackId) => {
    assert.equal(
      state.clips.ids.filter((clipId) => state.clips.byId[clipId].trackId === trackId).length,
      TOTAL_BARS,
    );
    assert.equal(state.matrix[trackId].length, TOTAL_BARS);
    state.matrix[trackId].forEach((bar, barIndex) => {
      assert.equal(bar.length, STEPS_PER_BAR);
      assert.deepEqual(bar, expectedMatrix[trackId][barIndex]);
    });
  });
});

test('multimodal UI keeps the approved Notion analysis copy and interactive instrument picker', async () => {
  const [
    screenSource,
    bpmSource,
    appSource,
    topBarSource,
    css,
  ] = await Promise.all([
    readFile(new URL('../src/app/components/MultimodalFlowScreen.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/components/BpmControl.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/components/TopBar.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/index.css', import.meta.url), 'utf8'),
  ]);

  assert.match(screenSource, /accept=\{MULTIMODAL_ACCEPT\}/);
  assert.match(screenSource, /controls[\s\S]*muted[\s\S]*playsInline/);
  assert.match(screenSource, /BpmControl/);
  assert.doesNotMatch(screenSource, /function ChoiceChips/);
  assert.match(screenSource, /function TrackRecommendationPicker/);
  assert.match(screenSource, /MULTIMODAL_RECOMMENDATION\.tracks\.slice\(0, 4\)/);
  assert.match(screenSource, /track-recommendation-list/);
  assert.match(screenSource, /track-timbre-options/);
  assert.match(screenSource, /results-copy-only/);
  assert.match(screenSource, /showFallbackCopy=\{false\}/);
  assert.match(screenSource, /unit="bpm"/);

  const resultsViewSource = screenSource.slice(
    screenSource.indexOf('function ResultsView'),
    screenSource.indexOf('function MultimodalFlowScreen'),
  );
  [
    '画面描述',
    '地面略微潮湿，刚下过雨，几个滑板青年悠闲地在街头漫步，穿着打扮符合日式街头潮流',
    '曲风描述',
    '整体应接近City Pop质感，音色听起来温暖、柔和；节奏中速偏慢，听起来悠闲舒缓的同时有较强的律动感，符合图中人物穿着的潮流感和街头感；旋律应偏向轻松明亮，同时有一定都市霓虹的现代感',
    'AI音乐风格建议',
    '速度和节奏',
    '中速偏慢 |',
    '4/4拍，节奏设计密集且律动感强',
    '乐器搭配',
    '旋律和声',
    'C大调，流行音乐最常用的Doo-Wop和弦进行，听感和谐流畅；配合七和弦增加听觉色彩和张力',
    'Cmaj7 - Am7 - Fmaj7 - G7',
  ].forEach((copy) => assert.match(resultsViewSource, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));

  [
    'Chill · 雨夜街头',
    'AI 推荐这 4 条轨道',
    '画面分析完成',
    '生成完整编曲',
    '查看和弦顺序与段落安排',
    '8 小节',
  ].forEach((copy) => assert.doesNotMatch(resultsViewSource, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
  [
    '鼓',
    '和弦',
    '低音',
    '旋律',
    '柔和电子鼓',
    '温暖电钢琴',
    '圆润电贝司',
    '空气感合成器',
  ].forEach((copy) => assert.match(screenSource, new RegExp(copy)));
  assert.match(bpmSource, /BPM_PRESETS\.map/);
  assert.match(bpmSource, /unit = 'BPM'/);
  assert.match(bpmSource, />\{unit\}<\/span>/);
  assert.match(bpmSource, /min=\{BPM_MIN\}/);
  assert.match(bpmSource, /max=\{BPM_MAX\}/);
  assert.match(bpmSource, /event\.key === 'ArrowUp'/);
  assert.match(topBarSource, /aria-haspopup="dialog"/);
  assert.match(topBarSource, /className="mobile-bpm-control"/);
  assert.match(appSource, /state\.setBpm\(nextBpm\)/);
  assert.match(appSource, /audioEngine\.setTempo\?\.\(nextBpm\)/);
  assert.match(appSource, /drumsRecording\.workflowLocked \|\| melodyRecording\.workflowLocked/);
  assert.match(appSource, /tutorialPanelState === 'running'/);
  assert.match(css, /\.results-copy-overview\s*\{[^}]*grid-template-columns:\s*220px minmax\(0,\s*1fr\);/s);
  assert.match(css, /\.results-copy-media\s*\{[^}]*width:\s*220px;[^}]*height:\s*148px;/s);
  assert.match(css, /\.results-advice-grid\s*\{[^}]*grid-template-columns:\s*280px minmax\(0,\s*1fr\);/s);
  assert.match(css, /\.results-instrument-card\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*2;/s);
  assert.match(css, /\.results-tempo-line \.bpm-presets\s*\{[^}]*display:\s*none;/s);
  assert.match(css, /\.results-icon-action\s*\{[^}]*width:\s*36px;[^}]*height:\s*36px;/s);
  assert.match(css, /\.genre-hardware:has\(\.results-copy-only\) \.genre-brand-text,[\s\S]*visibility:\s*hidden;/s);
  assert.match(css, /@media \(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)/);
  assert.match(css, /\.genre-gate:has\(\.multimodal-screen\)\s*\{[^}]*padding:\s*12px;[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.genre-hardware:has\(\.multimodal-screen\)\s*\{[^}]*min-height:\s*calc\(100dvh - 24px\);[^}]*padding:\s*18px;[^}]*gap:\s*12px;/s);
  assert.match(css, /\.multimodal-screen\s*\{[^}]*min-height:\s*0;[^}]*gap:\s*8px;[^}]*padding:\s*14px;/s);
  assert.match(css, /\.upload-screen \.upload-view\s*\{[^}]*min-height:\s*clamp\(477px,\s*calc\(823px - 22\.9vw\),\s*530px\);/s);
  assert.match(css, /\.bpm-popover\s*\{[^}]*position:\s*absolute;/s);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
