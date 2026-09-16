import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('genre options replace Jazz with the enabled AI multimodal entry', async () => {
  const {
    ARRANGER_GENRE_IDS,
    CURRENT_GENRE_ID,
    GENRE_OPTIONS,
    MULTIMODAL_DRUM_TEMPLATE_GENRE_ID,
    MULTIMODAL_GENRE_ID,
  } = await import('../src/app/genreOptions.js');

  assert.equal(CURRENT_GENRE_ID, 'pop');
  assert.equal(MULTIMODAL_GENRE_ID, 'ai-multimodal');
  assert.equal(MULTIMODAL_DRUM_TEMPLATE_GENRE_ID, 'electronic-edm');
  assert.deepEqual(ARRANGER_GENRE_IDS, [
    'pop',
    'hip-hop',
    'r-and-b',
    'electronic-edm',
    'rock',
  ]);
  assert.deepEqual(GENRE_OPTIONS.map((genre) => genre.label), [
    '流行 Pop',
    '嘻哈 Hip-Hop',
    'R&B',
    '电子 Electronic / EDM',
    '摇滚 Rock',
    'AI 多模态',
  ]);
  assert.deepEqual(GENRE_OPTIONS.map((genre) => genre.shortLabel), [
    'POP',
    'HIP-HOP',
    'R&B',
    'ELECTRONIC',
    'ROCK',
    'AI INPUT',
  ]);
  assert.deepEqual(GENRE_OPTIONS.map((genre) => genre.displayTitle), [
    '80年代复古流行乐',
    'City Pop',
    '现代独立流行',
    'Lofi电子乐',
    '复古摇滚',
    'AI 多模态创作',
  ]);
  assert.deepEqual(GENRE_OPTIONS.map((genre) => genre.description), [
    '轻快、明媚的迪斯科质感，旋律流畅悦耳，节奏跳动感强',
    '90年代的日本大都会独有的霓虹感，听感浪漫惬意',
    '质感暧昧朦胧，旋律暧昧飘忽，节奏富有律动，在极简的编曲中释放细腻而深沉的情绪。',
    '细腻朦胧的怀旧氛围，鼓点克制却富有律动，旋律平静舒缓',
    '明亮粗粝的吉他质感，鼓点直接有力，旋律鲜明上口，听感热烈自由',
    '上传图片或视频，让画面的色彩、情绪和动态变成一套编曲建议',
  ]);
  assert.deepEqual(GENRE_OPTIONS.map((genre) => genre.artImage), [
    '/assets/genre-art/pop-neon.png',
    '/assets/genre-art/hip-hop-neon.png',
    '/assets/genre-art/rnb-neon.png',
    '/assets/genre-art/electronic-neon.png',
    '/assets/genre-art/rock-neon.png',
    '/assets/genre-art/ai-multimodal-neon.png',
  ]);
  assert.deepEqual(GENRE_OPTIONS.map((genre) => genre.gemTone), [
    'blue',
    'purple',
    'amber',
    'green',
    'amber',
    'purple',
  ]);
  assert.equal(new Set(GENRE_OPTIONS.map((genre) => genre.id)).size, 6);
  assert.equal(GENRE_OPTIONS.find((genre) => genre.id === CURRENT_GENRE_ID)?.enabled, true);
  assert.deepEqual(GENRE_OPTIONS.map((genre) => genre.enabled), [
    true,
    true,
    true,
    true,
    true,
    true,
  ]);
  assert.deepEqual(GENRE_OPTIONS.slice(0, 5).map((genre) => genre.actionLabel), [
    '进入',
    '进入',
    '进入',
    '进入',
    '进入',
  ]);
  const multimodal = GENRE_OPTIONS.find((genre) => genre.id === MULTIMODAL_GENRE_ID);
  assert.equal(multimodal.entryType, 'multimodal');
  assert.equal(multimodal.actionLabel, '上传');
  assert.equal(multimodal.statusLabel, 'UPLOAD');
  assert.equal(GENRE_OPTIONS.every((genre) => genre.neon && genre.artImage), true);
  assert.equal(GENRE_OPTIONS.every((genre) => genre.displayTitle && genre.description), true);
  assert.equal(GENRE_OPTIONS.every((genre) => !('artKey' in genre)), true);
  assert.equal(GENRE_OPTIONS.every((genre) => !('subtitle' in genre)), true);
});

test('root owns the genre upload analysis results and arranger views', async () => {
  const mainSource = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
  const rootSource = await readFile(new URL('../src/app/Root.jsx', import.meta.url), 'utf8');

  assert.match(mainSource, /import Root from '\.\/app\/Root\.jsx';/);
  assert.match(mainSource, /createElement\(Root\)/);
  assert.match(rootSource, /const ROOT_VIEWS = Object\.freeze/);
  assert.match(rootSource, /useState\(ROOT_VIEWS\.GENRE\)/);
  assert.match(rootSource, /createElement\(GenreSelectScreen/);
  assert.match(rootSource, /createElement\(MultimodalFlowScreen/);
  assert.match(rootSource, /const \[genreId, setGenreId\] = useState\(CURRENT_GENRE_ID\)/);
  assert.match(rootSource, /ARRANGER_GENRE_IDS\.includes\(genreId\)/);
  assert.match(rootSource, /setGenreId\(genreId\)/);
  assert.match(rootSource, /setGenreId\(MULTIMODAL_DRUM_TEMPLATE_GENRE_ID\)/);
  assert.match(rootSource, /createElement\(App, \{[\s\S]*genreId,[\s\S]*performanceProfileId,[\s\S]*\}\)/);
  assert.match(rootSource, /genreId === MULTIMODAL_GENRE_ID/);
  assert.match(rootSource, /setView\(ROOT_VIEWS\.UPLOAD\)/);
  assert.match(rootSource, /setTimeout\(\(\) => setAnalysisStageIndex\(1\), 900\)/);
  assert.match(rootSource, /setTimeout\(\(\) => setView\(ROOT_VIEWS\.RESULTS\), 2700\)/);
  assert.match(rootSource, /timers\.forEach\(\(timer\) => window\.clearTimeout\(timer\)\)/);
  assert.match(rootSource, /URL\.createObjectURL\(file\)/);
  assert.match(rootSource, /URL\.revokeObjectURL\(previewUrl\)/);
  assert.match(rootSource, /createMultimodalRecommendationAppState\(\{ bpm \}\)/);
  assert.doesNotMatch(rootSource, /localStorage|sessionStorage/);
});

test('genre selection screen enters enabled cards and routes AI through its upload gem', async () => {
  const source = await readFile(
    new URL('../src/app/components/GenreSelectScreen.jsx', import.meta.url),
    'utf8',
  );
  const shellSource = await readFile(
    new URL('../src/app/components/HardwareFlowShell.jsx', import.meta.url),
    'utf8',
  );
  const cardHandler = source.match(/const handleGenreSelect = \(genre\) => \{[\s\S]*?\n\s{2}\};/)?.[0] ?? '';
  const actionHandler = source.match(/const handleGenreAction = \(genre\) => \{[\s\S]*?\n\s{2}\};/)?.[0] ?? '';

  assert.match(source, /function GenreSelectScreen/);
  assert.match(source, /useState\(currentGenreId\)/);
  assert.match(source, /selectedPreviewGenreId/);
  assert.match(cardHandler, /setSelectedPreviewGenreId\(genre\.id\)/);
  assert.match(cardHandler, /if \(genre\.enabled\) \{/);
  assert.match(cardHandler, /onGenreEnter\(genre\.id\)/);
  assert.match(actionHandler, /setSelectedPreviewGenreId\(genre\.id\)/);
  assert.match(actionHandler, /genre\.entryType === 'multimodal'/);
  assert.match(actionHandler, /\|\| genre\.enabled/);
  assert.match(actionHandler, /onGenreEnter\(genre\.id\)/);
  assert.match(source, /aria-pressed=\{selected\}/);
  assert.match(source, /data-selected=\{selected \? 'true' : undefined\}/);
  assert.match(source, /data-enabled=\{genre\.enabled \? 'true' : 'false'\}/);
  assert.match(source, /onClick=\{\(\) => handleGenreSelect\(genre\)\}/);
  assert.match(source, /aria-label=\{`选择\$\{genre\.displayTitle\}`\}/);
  assert.match(source, /className="genre-label"[\s\S]*\{genre\.displayTitle\}/);
  assert.match(source, /className="genre-art-frame"/);
  assert.match(source, /className="genre-art-image"/);
  assert.match(source, /src=\{genre\.artImage\}/);
  assert.match(source, /alt=""/);
  assert.match(source, /className="genre-description"[\s\S]*\{genre\.description\}/);
  assert.match(source, /className="genre-gem-button"/);
  assert.match(source, /const actionLabel = genre\.actionLabel \?\? '试听'/);
  assert.match(source, /aria-label=\{`\$\{actionLabel\} \$\{genre\.displayTitle\}`\}/);
  assert.match(source, /data-gem-tone=\{genre\.gemTone \?\? 'amber'\}/);
  assert.match(source, /onClick=\{\(\) => handleGenreAction\(genre\)\}/);
  assert.match(source, /className="genre-gem-socket"/);
  assert.match(source, /className="genre-gem-label"[\s\S]*\{actionLabel\}/);
  assert.match(source, /genre\.statusLabel \?\? \(genre\.enabled \? 'ENTER' : 'PREVIEW'\)/);
  assert.doesNotMatch(source, /genre-subtitle/);
  assert.doesNotMatch(source, /genre\.subtitle/);
  assert.match(source, /HardwareFlowShell/);
  assert.match(shellSource, /genre-side-rail/);
  assert.match(shellSource, /aria-hidden="true"/);
  assert.match(shellSource, /genre-knob/);
  assert.match(shellSource, /genre-control-button/);
  assert.match(shellSource, /className=\{`genre-hardware-control \$\{control\.type\}`\}/);
  assert.match(shellSource, /Volume2/);
  assert.doesNotMatch(source, /GENRE_ART_ICONS/);
  assert.doesNotMatch(source, /renderGenreArt/);
  assert.doesNotMatch(source, /genre-art-icon|genre-art-line/);
  assert.doesNotMatch(source, /\b(AudioWaveform|Building2|CircuitBoard|Disc3|Guitar|Mic2|Music2|SprayCan|Zap)\b/);
  assert.doesNotMatch(source, /LockKeyhole/);
  assert.doesNotMatch(source, /disabled=\{/);
  assert.doesNotMatch(source, /audioEngine|startAudio|previewChord|triggerDrums|triggerBass|triggerMelody/);
});
