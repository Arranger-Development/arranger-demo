import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

const TRACK_IDS = ['drums', 'chord', 'bass', 'melody', 'pad', 'vocal', 'sample'];

const SKEUO_ASSETS = [
  '../public/assets/skeuo/wall-texture.png',
  '../public/assets/skeuo/brushed-gunmetal-panel.png',
  '../public/assets/skeuo/dark-grid-panel.png',
  '../public/assets/skeuo/wood-panel.png',
  '../public/assets/skeuo/brass-panel.png',
  '../public/assets/skeuo/carbon-track-panel.png',
  '../public/assets/skeuo/gem-green.png',
  '../public/assets/skeuo/gem-amber.png',
  '../public/assets/skeuo/gem-blue.png',
  '../public/assets/skeuo/gem-purple.png',
  '../public/assets/skeuo/gem-new.png',
  '../public/assets/skeuo/clip-drums.png',
  '../public/assets/skeuo/clip-chord.png',
  '../public/assets/skeuo/clip-bass.png',
  '../public/assets/skeuo/clip-melody.png',
  '../public/assets/skeuo/clip-pad.png',
  '../public/assets/skeuo/clip-vocal.png',
  '../public/assets/skeuo/clip-sample.png',
  '../public/assets/skeuo/drum-step-off.png',
  '../public/assets/skeuo/drum-step-kick-on.png',
  '../public/assets/skeuo/drum-step-snare-on.png',
  '../public/assets/skeuo/drum-step-hihat-on.png',
  '../public/assets/skeuo/drum-control-button.png',
  '../public/assets/skeuo/drum-control-button-pressed.png',
  '../public/assets/skeuo/drum-control-button-disabled.png',
  '../public/assets/skeuo/drum-page-button.png',
  '../public/assets/skeuo/drum-close-button.png',
];

const GENRE_ART_ASSETS = [
  '../public/assets/genre-art/pop-neon.png',
  '../public/assets/genre-art/hip-hop-neon.png',
  '../public/assets/genre-art/rnb-neon.png',
  '../public/assets/genre-art/electronic-neon.png',
  '../public/assets/genre-art/rock-neon.png',
  '../public/assets/genre-art/jazz-neon.png',
];

const DRUM_PNG_SPECS = [
  ['../public/assets/skeuo/drum-step-off.png', 96, 96, 6],
  ['../public/assets/skeuo/drum-step-kick-on.png', 96, 96, 6],
  ['../public/assets/skeuo/drum-step-snare-on.png', 96, 96, 6],
  ['../public/assets/skeuo/drum-step-hihat-on.png', 96, 96, 6],
  ['../public/assets/skeuo/drum-control-button.png', 360, 104, 6],
  ['../public/assets/skeuo/drum-control-button-pressed.png', 360, 104, 6],
  ['../public/assets/skeuo/drum-control-button-disabled.png', 360, 104, 6],
  ['../public/assets/skeuo/drum-page-button.png', 112, 196, 6],
  ['../public/assets/skeuo/drum-close-button.png', 112, 112, 6],
];

async function readPngInfo(assetPath) {
  const bytes = await readFile(new URL(assetPath, import.meta.url));
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25],
  };
}

test('skeuomorphic theme provides project-local texture assets and material tokens', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  for (const assetPath of SKEUO_ASSETS) {
    await access(new URL(assetPath, import.meta.url));
  }

  assert.match(css, /--asset-wall:\s*url\("\/assets\/skeuo\/wall-texture\.png"\);/);
  assert.match(css, /--asset-metal:\s*url\("\/assets\/skeuo\/brushed-gunmetal-panel\.png"\);/);
  assert.match(css, /--asset-grid-panel:\s*url\("\/assets\/skeuo\/dark-grid-panel\.png"\);/);
  assert.match(css, /--asset-wood:\s*url\("\/assets\/skeuo\/wood-panel\.png"\);/);
  assert.match(css, /--asset-brass:\s*url\("\/assets\/skeuo\/brass-panel\.png"\);/);
  assert.match(css, /--asset-carbon:\s*url\("\/assets\/skeuo\/carbon-track-panel\.png"\);/);
  assert.match(css, /--asset-gem-green:\s*url\("\/assets\/skeuo\/gem-green\.png"\);/);
  assert.match(css, /--asset-gem-amber:\s*url\("\/assets\/skeuo\/gem-amber\.png"\);/);
  assert.match(css, /--asset-gem-blue:\s*url\("\/assets\/skeuo\/gem-blue\.png"\);/);
  assert.match(css, /--asset-gem-purple:\s*url\("\/assets\/skeuo\/gem-purple\.png"\);/);
  assert.match(css, /--asset-gem-new:\s*url\("\/assets\/skeuo\/gem-new\.png"\);/);
  assert.match(css, /--asset-clip-drums:\s*url\("\/assets\/skeuo\/clip-drums\.png"\);/);
  assert.match(css, /--asset-clip-chord:\s*url\("\/assets\/skeuo\/clip-chord\.png"\);/);
  assert.match(css, /--asset-clip-bass:\s*url\("\/assets\/skeuo\/clip-bass\.png"\);/);
  assert.match(css, /--asset-clip-melody:\s*url\("\/assets\/skeuo\/clip-melody\.png"\);/);
  assert.match(css, /--asset-clip-pad:\s*url\("\/assets\/skeuo\/clip-pad\.png"\);/);
  assert.match(css, /--asset-clip-vocal:\s*url\("\/assets\/skeuo\/clip-vocal\.png"\);/);
  assert.match(css, /--asset-clip-sample:\s*url\("\/assets\/skeuo\/clip-sample\.png"\);/);
  assert.match(css, /--asset-drum-step-off:\s*url\("\/assets\/skeuo\/drum-step-off\.png"\);/);
  assert.match(css, /--asset-drum-step-kick-on:\s*url\("\/assets\/skeuo\/drum-step-kick-on\.png"\);/);
  assert.match(css, /--asset-drum-step-snare-on:\s*url\("\/assets\/skeuo\/drum-step-snare-on\.png"\);/);
  assert.match(css, /--asset-drum-step-hihat-on:\s*url\("\/assets\/skeuo\/drum-step-hihat-on\.png"\);/);
  assert.match(css, /--asset-drum-control-button:\s*url\("\/assets\/skeuo\/drum-control-button\.png"\);/);
  assert.match(css, /--asset-drum-control-button-pressed:\s*url\("\/assets\/skeuo\/drum-control-button-pressed\.png"\);/);
  assert.match(css, /--asset-drum-control-button-disabled:\s*url\("\/assets\/skeuo\/drum-control-button-disabled\.png"\);/);
  assert.match(css, /--asset-drum-page-button:\s*url\("\/assets\/skeuo\/drum-page-button\.png"\);/);
  assert.match(css, /--asset-drum-close-button:\s*url\("\/assets\/skeuo\/drum-close-button\.png"\);/);
  assert.match(css, /--hardware-copper:/);
  assert.match(css, /--hardware-gold:/);
  assert.match(css, /--hardware-shadow-deep:/);
  assert.match(css, /--hardware-control-ink:\s*#f4d9ad;/);
  assert.match(css, /--hardware-control-muted:\s*#a98b68;/);
  assert.match(css, /--hardware-control-bg:\s*rgb\(18 11 7 \/ 0\.44\);/);
  assert.match(css, /--hardware-control-border:\s*rgb\(255 219 164 \/ 0\.34\);/);
  assert.match(css, /--hardware-chord-ink-strong:\s*#ffe2b6;/);
});

test('ui shell keeps the editor usable and confines mobile overflow to panels', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /--app-topbar-height:\s*clamp\(52px,\s*7vh,\s*64px\);/);
  assert.match(css, /--app-editor-height:\s*clamp\(260px,\s*39vh,\s*330px\);/);
  assert.match(css, /--timeline-min-width:\s*min\(640px,\s*100%\);/);
  assert.match(css, /--timeline-clip-y-inset:\s*6px;/);
  assert.match(css, /--timeline-bar-x-inset:\s*4px;/);
  assert.match(css, /\.app\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s);
  assert.match(css, /\.app\s*\{[^}]*height:\s*100dvh;/s);
  assert.match(css, /\.app\s*\{[^}]*position:\s*relative;/s);
  assert.match(css, /\.app-main\s*\{[^}]*grid-template-rows:\s*var\(--app-topbar-height\) minmax\(0,\s*1fr\) var\(--app-editor-height\);/s);
  assert.match(css, /\.workspace\s*\{[^}]*grid-template-columns:\s*clamp\(188px,\s*18vw,\s*246px\) minmax\(0,\s*1fr\);/s);
  assert.match(css, /\.editor\s*\{[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.seq-body\s*\{[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.piano-roll-grid\s*\{[^}]*min-width:\s*0;/s);
  assert.match(css, /grid-template-columns:\s*168px minmax\(0,\s*1fr\);/);
  assert.match(css, /\.stat:nth-child\(4\)\s*\{[^}]*display:\s*none;/s);
});

test('genre gate uses a hardware cabinet with responsive neon style cards', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  for (const assetPath of GENRE_ART_ASSETS) {
    await access(new URL(assetPath, import.meta.url));
  }

  assert.match(css, /\.genre-gate\s*\{[^}]*min-height:\s*100dvh;/s);
  assert.match(css, /\.genre-gate\s*\{[^}]*overflow:\s*auto;/s);
  assert.match(css, /\.genre-hardware\s*\{[^}]*var\(--asset-wood\)/s);
  assert.match(css, /\.genre-hardware\s*\{[^}]*isolation:\s*isolate;/s);
  assert.match(css, /\.genre-hardware\s*\{[^}]*var\(--asset-brass\)/s);
  assert.match(css, /\.genre-hardware\s*\{[^}]*--genre-frame-depth:\s*clamp\(22px,\s*2\.2vw,\s*38px\);/s);
  assert.match(css, /\.genre-hardware\s*\{[^}]*--genre-panel-recess:\s*clamp\(8px,\s*0\.8vw,\s*14px\);/s);
  assert.match(css, /\.genre-hardware\s*\{[^}]*--genre-panel-top-inset:\s*clamp\(10px,\s*1vw,\s*18px\);/s);
  assert.match(css, /\.genre-hardware\s*\{[^}]*--genre-panel-bottom-inset:\s*clamp\(2px,\s*0\.35vw,\s*7px\);/s);
  assert.match(css, /\.genre-hardware\s*\{[^}]*--genre-side-cheek-width:\s*clamp\(54px,\s*5\.2vw,\s*86px\);/s);
  assert.match(css, /\.genre-hardware\s*\{[^}]*--genre-side-rail-inset:\s*clamp\(38px,\s*3vw,\s*56px\);/s);
  assert.match(css, /\.genre-hardware\s*\{[^}]*grid-template-columns:\s*clamp\(146px,\s*13vw,\s*208px\) minmax\(0,\s*1fr\) clamp\(146px,\s*13vw,\s*208px\);/s);
  assert.match(css, /\.genre-hardware\s*\{[^}]*clip-path:\s*polygon\(var\(--genre-panel-top-inset\) 0/s);
  assert.match(css, /\.genre-hardware\s*\{[^}]*background:[^}]*var\(--genre-frame-depth\)[^}]*var\(--genre-panel-recess\)/s);
  assert.match(css, /\.genre-hardware\s*\{[^}]*background:[^}]*var\(--genre-panel-top-inset\)[^}]*var\(--genre-panel-bottom-inset\)/s);
  assert.match(css, /\.genre-hardware\s*\{[^}]*box-shadow:[^}]*inset 0 0 0 2px/s);
  assert.match(css, /\.genre-hardware\s*\{[^}]*box-shadow:[^}]*inset 0 0 0 var\(--genre-panel-recess\)/s);
  assert.match(css, /\.genre-hardware::before,\s*\n\.genre-hardware::after\s*\{[^}]*content:\s*"";/s);
  assert.match(css, /\.genre-hardware::before,\s*\n\.genre-hardware::after\s*\{[^}]*pointer-events:\s*none;/s);
  assert.match(css, /\.genre-hardware::before,\s*\n\.genre-hardware::after\s*\{[^}]*var\(--asset-wood\)/s);
  assert.match(css, /\.genre-hardware::before,\s*\n\.genre-hardware::after\s*\{[^}]*clip-path:\s*polygon\(/s);
  assert.match(css, /\.genre-hardware::before,\s*\n\.genre-hardware::after\s*\{[^}]*filter:\s*drop-shadow/s);
  assert.match(css, /\.genre-hardware::before\s*\{[^}]*left:\s*-2px;/s);
  assert.match(css, /\.genre-hardware::before\s*\{[^}]*border-radius:\s*12px 4px 4px 12px;/s);
  assert.match(css, /\.genre-hardware::before\s*\{[^}]*clip-path:\s*polygon\(0 0,\s*100% 0,\s*92% 100%,\s*0 100%\);/s);
  assert.match(css, /\.genre-hardware::after\s*\{[^}]*right:\s*-2px;/s);
  assert.match(css, /\.genre-hardware::after\s*\{[^}]*border-radius:\s*4px 12px 12px 4px;/s);
  assert.match(css, /\.genre-hardware::after\s*\{[^}]*clip-path:\s*polygon\(8% 0,\s*100% 0,\s*100% 100%,\s*0 100%\);/s);
  assert.doesNotMatch(css, /\.genre-hardware::(?:before|after)\s*\{[^}]*rotateY/s);
  assert.match(css, /\.genre-console,\s*\n\.genre-side-rail\s*\{[^}]*z-index:\s*1;/s);
  assert.match(css, /\.genre-console\s*\{[^}]*grid-template-rows:\s*auto auto;/s);
  assert.match(css, /\.genre-console\s*\{[^}]*align-content:\s*center;/s);
  assert.match(css, /\.genre-console\s*\{[^}]*width:\s*min\(100%,\s*1040px\);/s);
  assert.match(css, /\.genre-console\s*\{[^}]*justify-self:\s*center;/s);
  assert.doesNotMatch(css, /\.genre-console\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\) auto;/s);
  assert.match(css, /\.genre-screen\s*\{[^}]*var\(--asset-grid-panel\)/s);
  assert.match(css, /\.genre-screen\s*\{[^}]*border:\s*2px solid var\(--hardware-gold\);/s);
  assert.match(css, /\.genre-screen\s*\{[^}]*gap:\s*14px;/s);
  assert.match(css, /\.genre-screen\s*\{[^}]*padding:\s*18px;/s);
  assert.match(css, /\.genre-screen\s*\{[^}]*box-shadow:[^}]*0 0 0 8px/s);
  assert.match(css, /\.genre-screen::before\s*\{[^}]*z-index:\s*0;/s);
  assert.match(css, /\.genre-screen::after\s*\{[^}]*content:\s*"";/s);
  assert.match(css, /\.genre-screen::after\s*\{[^}]*pointer-events:\s*none;/s);
  assert.match(css, /\.genre-screen::after\s*\{[^}]*box-shadow:[^}]*inset/s);
  assert.match(css, /\.genre-gate-head,\s*\n\.genre-grid\s*\{[^}]*z-index:\s*2;/s);
  assert.match(css, /\.genre-side-rail\s*\{[^}]*display:\s*grid;/s);
  assert.match(css, /\.genre-side-rail\.left\s*\{[^}]*transform:\s*translateX\(var\(--genre-side-rail-inset\)\);/s);
  assert.match(css, /\.genre-side-rail\.right\s*\{[^}]*transform:\s*translateX\(calc\(var\(--genre-side-rail-inset\) \* -1\)\);/s);
  assert.match(css, /\.genre-knob\s*\{[^}]*border-radius:\s*50%;/s);
  assert.match(css, /\.genre-control-button\s*\{[^}]*pointer-events:\s*none;/s);
  assert.match(css, /\.genre-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(css, /\.genre-grid\s*\{[^}]*gap:\s*16px 18px;/s);
  assert.match(css, /\.genre-card-shell\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*auto\) auto;/s);
  assert.match(css, /\.genre-card-shell\s*\{[^}]*gap:\s*6px;/s);
  assert.match(css, /\.genre-card-shell\s*\{[^}]*padding-bottom:\s*0;/s);
  assert.match(css, /\.genre-card\s*\{[^}]*--genre-neon:/s);
  assert.match(css, /\.genre-card\s*\{[^}]*grid-template-rows:\s*auto minmax\(76px,\s*1fr\) auto;/s);
  assert.match(css, /\.genre-card\s*\{[^}]*min-height:\s*188px;/s);
  assert.match(css, /\.genre-card\s*\{[^}]*border:\s*2px solid color-mix\(in oklab,\s*var\(--genre-neon\)/s);
  assert.match(css, /\.genre-card\[data-selected="true"\]\s*\{/s);
  assert.match(css, /\.genre-card\[data-enabled="false"\]\s*\{/s);
  assert.match(css, /\.genre-label\s*\{[^}]*grid-row:\s*1;/s);
  assert.match(css, /\.genre-label\s*\{[^}]*font-size:\s*clamp\(20px,\s*1\.55vw,\s*24px\);/s);
  assert.match(css, /\.genre-label\s*\{[^}]*white-space:\s*normal;/s);
  assert.match(css, /\.genre-art-frame\s*\{[^}]*grid-row:\s*2;/s);
  assert.match(css, /\.genre-art-frame\s*\{[^}]*pointer-events:\s*none;/s);
  assert.match(css, /\.genre-art-image\s*\{[^}]*object-fit:\s*contain;/s);
  assert.match(css, /\.genre-art-frame\s*\{[^}]*min-height:\s*76px;/s);
  assert.match(css, /\.genre-art-image\s*\{[^}]*height:\s*clamp\(70px,\s*6\.2vw,\s*96px\);/s);
  assert.match(css, /\.genre-art-image\s*\{[^}]*filter:\s*drop-shadow/s);
  assert.match(css, /\.genre-description\s*\{[^}]*position:\s*absolute;/s);
  assert.match(css, /\.genre-description\s*\{[^}]*opacity:\s*0;/s);
  assert.match(css, /\.genre-description\s*\{[^}]*visibility:\s*hidden;/s);
  assert.match(css, /\.genre-description\s*\{[^}]*pointer-events:\s*none;/s);
  assert.match(css, /\.genre-description\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
  assert.match(css, /\.genre-description\s*\{[^}]*white-space:\s*normal;/s);
  assert.doesNotMatch(css, /\.genre-description\s*\{[^}]*white-space:\s*nowrap;/s);
  assert.match(css, /\.genre-card:hover \.genre-description,\s*\n\.genre-card:focus \.genre-description,\s*\n\.genre-card:focus-visible \.genre-description\s*\{[^}]*opacity:\s*1;/s);
  assert.match(css, /\.genre-card:hover \.genre-description,\s*\n\.genre-card:focus \.genre-description,\s*\n\.genre-card:focus-visible \.genre-description\s*\{[^}]*visibility:\s*visible;/s);
  assert.doesNotMatch(css, /\.genre-description\s*\{[^}]*grid-row:/s);
  assert.match(css, /\.genre-status\s*\{[^}]*grid-row:\s*3;/s);
  assert.match(css, /\.genre-status\s*\{[^}]*max-width:\s*100%;/s);
  assert.match(css, /\.genre-status\s*\{[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.genre-gem-button\s*\{[^}]*display:\s*grid;/s);
  assert.match(css, /\.genre-gem-button\s*\{[^}]*width:\s*min\(98px,\s*100%\);/s);
  assert.match(css, /\.genre-gem-button\s*\{[^}]*min-height:\s*48px;/s);
  assert.match(css, /\.genre-gem-button\s*\{[^}]*cursor:\s*pointer;/s);
  assert.match(css, /\.genre-gem-button\s*\{[^}]*touch-action:\s*manipulation;/s);
  assert.match(css, /\.genre-card-shell\[data-gem-tone="blue"\]\s*\{[^}]*--genre-gem-asset:\s*var\(--asset-gem-blue\);/s);
  assert.match(css, /\.genre-card-shell\[data-gem-tone="purple"\]\s*\{[^}]*--genre-gem-asset:\s*var\(--asset-gem-purple\);/s);
  assert.match(css, /\.genre-card-shell\[data-gem-tone="green"\]\s*\{[^}]*--genre-gem-asset:\s*var\(--asset-gem-green\);/s);
  assert.match(css, /\.genre-card-shell\[data-gem-tone="amber"\]\s*\{[^}]*--genre-gem-asset:\s*var\(--asset-gem-amber\);/s);
  assert.match(css, /\.genre-gem-socket\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center;/s);
  assert.match(css, /\.genre-gem-socket\s*\{[^}]*height:\s*36px;/s);
  assert.match(css, /\.genre-gem-socket\s*\{[^}]*var\(--asset-brass\)/s);
  assert.match(css, /\.genre-gem-socket\s*\{[^}]*box-shadow:[^}]*inset/s);
  assert.match(css, /\.genre-gem-socket::before\s*\{[^}]*content:\s*"";/s);
  assert.match(css, /\.genre-gem-socket::after\s*\{[^}]*content:\s*"";/s);
  assert.match(css, /\.genre-gem\s*\{[^}]*var\(--genre-gem-asset,\s*var\(--asset-gem-amber\)\)/s);
  assert.match(css, /\.genre-gem-button:hover \.genre-gem-socket,/s);
  assert.match(css, /\.genre-gem-button:hover \.genre-gem,/s);
  assert.match(css, /\.genre-gem-label\s*\{[^}]*font-size:/s);
  assert.match(css, /\.genre-control-label\s*\{[^}]*width:\s*min\(118px,\s*100%\);/s);
  assert.match(css, /\.genre-control-label\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
  assert.match(css, /\.genre-hardware-control\s*\{[^}]*position:\s*relative;/s);
  assert.match(css, /\.genre-hardware-control\.knob::before\s*\{[^}]*radial-gradient/s);
  assert.match(css, /\.genre-knob::before\s*\{[^}]*content:\s*"";/s);
  assert.match(css, /\.genre-knob::after\s*\{[^}]*transform-origin:\s*50% 24px;/s);
  assert.match(css, /\.genre-control-button\s*\{[^}]*background:[^}]*linear-gradient\(180deg,\s*rgb\(255 255 255 \/ 0\.18\)/s);
  assert.match(css, /\.genre-control-button::before\s*\{[^}]*content:\s*"";/s);
  assert.match(css, /\.genre-control-button::after\s*\{[^}]*content:\s*"";/s);
  assert.match(css, /\.genre-control-light\s*\{[^}]*z-index:\s*1;/s);
  assert.match(css, /\.genre-control-button\.dot \.genre-control-light\s*\{[^}]*border-radius:\s*50%;/s);
  assert.doesNotMatch(css, /\.genre-card-shell\s*\{[^}]*position:\s*relative;/s);
  assert.doesNotMatch(css, /\.genre-gem\s*\{[^}]*position:\s*absolute;/s);
  assert.doesNotMatch(css, /\.genre-art-icon(?:\s|[.#:{])/);
  assert.doesNotMatch(css, /\.genre-art-line(?:\s|[.#:{])/);
  assert.doesNotMatch(css, /\.genre-subtitle(?:\s|[.#:{])/);
  assert.match(css, /@media\s*\(max-width:\s*860px\)\s*\{[\s\S]*\.genre-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(css, /@media\s*\(max-width:\s*860px\)\s*\{[\s\S]*\.genre-side-rail\.left,\s*\n\s*\.genre-side-rail\.right\s*\{[^}]*transform:\s*none;/s);
  assert.match(css, /@media\s*\(max-width:\s*860px\)\s*\{[\s\S]*\.genre-hardware::before,\s*\n\s*\.genre-hardware::after\s*\{[^}]*width:\s*18px;/s);
  assert.match(css, /@media\s*\(max-width:\s*560px\)\s*\{[\s\S]*\.genre-gate\s*\{[^}]*justify-items:\s*center;/s);
  assert.match(css, /@media\s*\(max-width:\s*560px\)\s*\{[\s\S]*\.genre-hardware\s*\{[^}]*width:\s*100%;/s);
  assert.match(css, /@media\s*\(max-width:\s*560px\)\s*\{[\s\S]*\.genre-hardware\s*\{[^}]*max-width:\s*100%;/s);
  assert.match(css, /@media\s*\(max-width:\s*560px\)\s*\{[\s\S]*\.genre-hardware::before,\s*\n\s*\.genre-hardware::after\s*\{[^}]*width:\s*10px;/s);
  assert.match(css, /@media\s*\(max-width:\s*560px\)\s*\{[\s\S]*\.genre-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s);
});

test('topbar new button is only a distinct gem without a brass frame', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.btn-new\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center;/s);
  assert.match(css, /\.btn-new\s*\{[^}]*background:\s*transparent;/s);
  assert.match(css, /\.btn-new\s*\{[^}]*border:\s*0;/s);
  assert.match(css, /\.btn-new\s*\{[^}]*box-shadow:\s*none;/s);
  assert.doesNotMatch(css, /\.btn-new\s*\{[^}]*var\(--asset-brass\)/s);
  assert.match(css, /\.btn-new-label\s*\{[^}]*color:\s*#ffe5bd;/s);
  assert.match(css, /\.btn-new-label\s*\{[^}]*text-shadow:\s*0 1px 0 rgb\(0 0 0 \/ 0\.72\)/s);
  assert.match(css, /\.power-gem\s*\{[^}]*var\(--asset-gem-new\)[^}]*#8f1f52/s);
  assert.match(css, /\.power-gem\s*\{[^}]*clip-path:\s*polygon\(/s);
});

test('new song confirmation uses the hardware modal surface', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.new-song-confirm-overlay\s*\{[^}]*position:\s*absolute;/s);
  assert.match(css, /\.new-song-confirm-overlay\s*\{[^}]*inset:\s*0;/s);
  assert.match(css, /\.new-song-confirm-overlay\s*\{[^}]*z-index:\s*70;/s);
  assert.match(css, /\.new-song-confirm-dialog\s*\{[^}]*display:\s*grid;/s);
  assert.match(css, /\.new-song-confirm-dialog\s*\{[^}]*var\(--asset-brass\)/s);
  assert.match(css, /\.new-song-confirm-title\s*\{[^}]*color:\s*#ffe7bd;/s);
  assert.match(css, /\.new-song-confirm-copy\s*\{[^}]*color:\s*#d9c09a;/s);
  assert.match(css, /\.new-song-confirm-actions\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /\.new-song-confirm-cancel,\s*\n\.new-song-confirm-apply\s*\{[^}]*min-height:\s*38px;/s);
  assert.match(css, /\.new-song-confirm-apply\s*\{[^}]*background:\s*linear-gradient\(180deg,\s*#ffe0a8,\s*#9b6430\);/s);
});

test('topbar tutorial and save switches render as sculpted buttons without key shafts', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const topBarSource = await readFile(new URL('../src/app/components/TopBar.jsx', import.meta.url), 'utf8');
  const topbarCenterBlock = topBarSource.match(/<div className="topbar-center">([\s\S]*?)\n\s*<div className="right-tools">/)?.[1] ?? '';

  assert.match(topBarSource, /<button className="btn-new"[\s\S]*<\/button>\s*\n\s*<div className="topbar-left-controls">[\s\S]*<div className="history-controls" role="toolbar" aria-label="History">[\s\S]*<div className=\{transportClassName\} role="toolbar" aria-label="Transport">[\s\S]*className="mobile-bpm-control"[\s\S]*<\/div>\s*\n\s*<div className="topbar-center">\s*\n\s*<div className="hardware-status-display">/);
  assert.doesNotMatch(topbarCenterBlock, /history-controls|transportClassName/);
  assert.match(css, /\.topbar-left-controls\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /\.topbar-left-controls\s*\{[^}]*grid-column:\s*3;/s);
  assert.match(css, /\.topbar-left-controls\s*\{[^}]*justify-self:\s*start;/s);
  const topbarCenterRule = [...css.matchAll(/\.topbar-center\s*\{([^}]*)\}/gs)]
    .map((match) => match[1])
    .find((rule) => /grid-column:\s*4;/.test(rule)) ?? '';
  assert.match(css, /\.topbar\s*\{[^}]*grid-template-columns:\s*minmax\(168px,\s*max-content\) max-content minmax\(0,\s*max-content\) minmax\(260px,\s*1fr\) max-content;/s);
  assert.match(css, /\.brand\s*\{[^}]*width:\s*clamp\(168px,\s*14vw,\s*226px\);/s);
  assert.match(topbarCenterRule, /position:\s*relative;/);
  assert.match(topbarCenterRule, /grid-column:\s*4;/);
  assert.match(topbarCenterRule, /grid-row:\s*1;/);
  assert.match(topbarCenterRule, /width:\s*min\(100%,\s*max-content\);/);
  assert.doesNotMatch(topbarCenterRule, /position:\s*absolute;/);
  assert.doesNotMatch(topbarCenterRule, /transform:\s*translate\(-50%,\s*-50%\);/);
  assert.match(css, /\.topbar-center > \* \{\s*pointer-events:\s*none;\s*\}/s);
  assert.match(css, /\.hardware-status-display\s*\{[^}]*justify-self:\s*center;/s);
  assert.doesNotMatch(css, /--topbar-center-side-balance/);
  assert.doesNotMatch(css, /\.topbar-center::after/);
  assert.doesNotMatch(css, /\.topbar-center \.history-controls/);
  assert.doesNotMatch(css, /\.topbar-center \.transport/);
  assert.match(css, /@media \(max-width:\s*1180px\)\s*\{[\s\S]*\.right-tools \.save-switch,\s*\n\s*\.right-tools \.hardware-export,\s*\n\s*\.right-tools \.icon-btn:not\(\.tutorial-topbar-button\)\s*\{[^}]*display:\s*none;/);
  assert.match(css, /@media \(max-width:\s*1100px\)\s*\{[\s\S]*\.topbar-left-controls\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*2;[^}]*overflow-x:\s*auto;/);
  assert.match(css, /@media \(max-width:\s*980px\)\s*\{[\s\S]*\.topbar-center\s*\{[^}]*display:\s*none;/);
  assert.match(css, /\.key-switch\s*\{[^}]*align-items:\s*center;/s);
  assert.match(css, /\.key-switch\s*\{[^}]*height:\s*38px;/s);
  assert.match(css, /\.key-switch\s*\{[^}]*padding:\s*0 14px;/s);
  assert.match(css, /\.key-switch\s*\{[^}]*var\(--asset-brass\) center \/ cover/s);
  assert.match(css, /\.key-switch\s*\{[^}]*border:\s*1px solid rgb\(255 219 164 \/ 0\.42\);/s);
  assert.match(css, /\.key-switch\s*\{[^}]*border-radius:\s*12px;/s);
  assert.match(css, /\.key-switch\s*\{[^}]*inset 0 -9px 16px rgb\(0 0 0 \/ 0\.54\)/s);
  assert.match(css, /\.key-switch::before\s*\{[^}]*inset:\s*3px;/s);
  assert.match(css, /\.key-switch::before\s*\{[^}]*border-radius:\s*9px;/s);
  assert.match(css, /\.key-switch::after\s*\{[^}]*content:\s*none;/s);
  assert.doesNotMatch(css, /\.key-switch::after\s*\{[^}]*left:\s*calc\(50% \+ 17px\);/s);
  assert.doesNotMatch(css, /\.key-switch::after\s*\{[^}]*width:\s*24px;/s);
  assert.match(css, /\.save-switch \.dot\s*\{[^}]*display:\s*inline-block;/s);
  assert.match(css, /\.save-switch \.dot\s*\{[^}]*radial-gradient\(circle at 38% 28%/s);
});

test('short mac viewport compacts hardware chrome before text can collide', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /@media\s*\(max-height:\s*720px\)\s*\{[\s\S]*\.app\s*\{[^}]*--app-editor-height:\s*clamp\(220px,\s*36vh,\s*260px\);/s);
  assert.match(css, /@media\s*\(max-height:\s*720px\)\s*\{[\s\S]*\.app:has\(\.editor\[data-screen-label="Drum Sequencer"\]:not\(\[data-picker="drum-template"\]\)\),\s*\n\s*\.app:has\(\.editor\[data-screen-label="Chord Editor"\]:not\(\[data-picker="chord"\]\):not\(\[data-picker="groove"\]\)\),\s*\n\s*\.app:has\(\.editor\[data-screen-label="Melody Editor"\]:not\(\[data-picker="style"\]\)\),\s*\n\s*\.app:has\(\.editor\[data-screen-label="Bass Editor"\]:not\(\[data-picker="groove"\]\)\)\s*\{[^}]*--app-editor-height:\s*clamp\(360px,\s*52vh,\s*390px\);/s);
  assert.match(css, /@media\s*\(max-height:\s*720px\)\s*\{[\s\S]*\.app:has\(\.editor\[data-screen-label="Drum Sequencer"\]:not\(\[data-picker="drum-template"\]\)\),\s*\n\s*\.app:has\(\.editor\[data-screen-label="Chord Editor"\]:not\(\[data-picker="chord-workspace"\]\):not\(\[data-picker="chord"\]\):not\(\[data-picker="groove"\]\)\),\s*\n\s*\.app:has\(\.editor\[data-screen-label="Melody Editor"\]:not\(\[data-picker="style"\]\)\),\s*\n\s*\.app:has\(\.editor\[data-screen-label="Bass Editor"\]:not\(\[data-picker="groove"\]\)\)\s*\{[^}]*--app-editor-height:\s*clamp\(360px,\s*52vh,\s*390px\);/s);
  assert.match(css, /@media\s*\(max-height:\s*720px\)\s*\{[\s\S]*\.app:has\(\.editor\[data-picker="chord"\]\),\s*\n\s*\.app:has\(\.editor\[data-picker="groove"\]\),\s*\n\s*\.app:has\(\.editor\[data-picker="style"\]\)\s*\{[^}]*--app-editor-height:\s*clamp\(270px,\s*46vh,\s*360px\);/s);
  assert.match(css, /@media\s*\(max-height:\s*720px\)\s*\{[\s\S]*\.track\s*\{[^}]*padding:\s*6px 10px;[^}]*grid-template-rows:\s*32px 14px;[^}]*gap:\s*2px;/s);
  assert.match(css, /@media\s*\(max-height:\s*720px\)\s*\{[\s\S]*\.track-select\s*\{[^}]*grid-template-columns:\s*34px minmax\(0,\s*1fr\);/s);
  assert.match(css, /@media\s*\(max-height:\s*720px\)\s*\{[\s\S]*\.fill-empty-clips\s*\{[^}]*width:\s*46px;[^}]*max-width:\s*46px;[^}]*height:\s*34px;[^}]*overflow:\s*hidden;/s);
  assert.match(css, /@media\s*\(max-height:\s*720px\)\s*\{[\s\S]*\.fill-gem\s*\{[^}]*width:\s*20px;[^}]*height:\s*20px;/s);
  assert.match(css, /@media\s*\(max-height:\s*720px\)\s*\{[\s\S]*\.fill-empty-clips-label\s*\{[^}]*max-width:\s*46px;[^}]*margin-top:\s*0;[^}]*font-size:\s*8px;[^}]*line-height:\s*1;/s);
  assert.match(css, /@media\s*\(max-height:\s*720px\)\s*\{[\s\S]*\.vol\s*\{[^}]*margin-left:\s*40px;[^}]*padding-right:\s*54px;/s);
  assert.match(css, /@media\s*\(max-height:\s*720px\)\s*\{[\s\S]*\.empty-editor\s*\{[^}]*max-width:\s*min\(460px,\s*70vw\);[^}]*overflow-wrap:\s*anywhere;/s);
});

test('fourteen inch mac demo viewport uses a dense one-screen tutorial layout', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.app\s*\{[^}]*--app-topbar-height:\s*46px;[^}]*--app-editor-height:\s*clamp\(250px,\s*43vh,\s*286px\);[^}]*--track-row-min-height:\s*56px;[^}]*--tutorial-footer-height:\s*32px;/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.app:has\(\.editor\[data-screen-label="Drum Sequencer"\]:not\(\[data-picker="drum-template"\]\)\),\s*\n\s*\.app:has\(\.editor\[data-screen-label="Chord Editor"\]:not\(\[data-picker="chord"\]\):not\(\[data-picker="groove"\]\)\),\s*\n\s*\.app:has\(\.editor\[data-screen-label="Melody Editor"\]:not\(\[data-picker="style"\]\)\),\s*\n\s*\.app:has\(\.editor\[data-screen-label="Bass Editor"\]:not\(\[data-picker="groove"\]\)\)\s*\{[^}]*--app-editor-height:\s*clamp\(420px,\s*54vh,\s*560px\);/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.app:has\(\.editor\[data-picker="chord"\]\),\s*\n\s*\.app:has\(\.editor\[data-picker="groove"\]\),\s*\n\s*\.app:has\(\.editor\[data-picker="style"\]\)\s*\{[^}]*--app-editor-height:\s*clamp\(286px,\s*48vh,\s*332px\);/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.topbar\s*\{[^}]*grid-template-columns:\s*minmax\(148px,\s*176px\) minmax\(62px,\s*max-content\) max-content minmax\(224px,\s*1fr\) max-content;[^}]*gap:\s*8px;[^}]*padding:\s*0 12px;/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.workspace\.tutorial-sidebar-open\s*\{[^}]*grid-template-columns:\s*clamp\(164px,\s*15vw,\s*196px\) minmax\(0,\s*1fr\) clamp\(248px,\s*20vw,\s*294px\);/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.tutorial-panel\s*\{[^}]*grid-template-rows:\s*40px minmax\(0,\s*1fr\) var\(--tutorial-footer-height\);/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.tutorial-panel-body\s*\{[^}]*align-content:\s*start;[^}]*padding:\s*10px 12px;[^}]*overflow:\s*hidden;/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.tutorial-copy-title\s*\{[^}]*font-size:\s*11px;/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.tutorial-copy-subtitle\s*\{[^}]*font-size:\s*20px;/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.tutorial-copy-body\s*\{[^}]*font-size:\s*14px;[^}]*line-height:\s*1\.45;/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.editor-head\s*\{[^}]*min-height:\s*44px;[^}]*padding:\s*0 12px;/s);
});

test('fourteen inch mac demo viewport reserves separate space for transport and status', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.topbar-left-controls\s*\{[^}]*grid-column:\s*3;[^}]*z-index:\s*2;[^}]*justify-self:\s*start;/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.topbar-center\s*\{[^}]*position:\s*relative;[^}]*grid-column:\s*4;[^}]*grid-row:\s*1;[^}]*width:\s*min\(100%,\s*max-content\);[^}]*max-width:\s*100%;/s);
  assert.doesNotMatch(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.topbar-center\s*\{[^}]*position:\s*absolute;/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.right-tools\s*\{[^}]*grid-column:\s*5;[^}]*justify-self:\s*end;/s);
});

test('fourteen inch mac demo viewport compacts real topbar controls without overflow', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.btn-new\s*\{[^}]*grid-template-columns:\s*30px auto;[^}]*min-width:\s*68px;[^}]*height:\s*36px;[^}]*overflow:\s*hidden;/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.power-gem\s*\{[^}]*width:\s*30px;[^}]*height:\s*30px;/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.tutorial-switch\s*\{[^}]*height:\s*32px;[^}]*min-width:\s*54px;/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.save-switch\s*\{[^}]*width:\s*34px;[^}]*min-width:\s*34px;[^}]*padding:\s*0;[^}]*font-size:\s*0;/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.hardware-export\s*\{[^}]*height:\s*32px;[^}]*padding:\s*0 14px;[^}]*font-size:\s*12px;/s);
});

test('fourteen inch mac demo viewport keeps highlighted tutorial targets obvious', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.app\s*\{[^}]*--tutorial-breathe-duration:\s*1\.6s;/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.app\s*\{[^}]*--tutorial-highlight-rest-filter:\s*brightness\(1\.28\) saturate\(1\.22\);[^}]*--tutorial-highlight-peak-filter:\s*brightness\(1\.62\) saturate\(1\.4\);/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*--tutorial-highlight-rest-shadow:[\s\S]*0 0 0 3px color-mix\(in oklab,\s*white 68%,\s*transparent\),[\s\S]*0 0 0 8px color-mix\(in oklab,\s*var\(--tutorial-highlight-accent\) 34%,\s*transparent\),/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*--tutorial-highlight-peak-shadow:[\s\S]*0 0 0 4px color-mix\(in oklab,\s*white 82%,\s*transparent\),[\s\S]*0 0 0 11px color-mix\(in oklab,\s*var\(--tutorial-highlight-accent\) 42%,\s*transparent\),/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*--tutorial-target-contained-rest-shadow:[\s\S]*0 0 0 6px color-mix\(in oklab,\s*var\(--tutorial-highlight-accent\) 24%,\s*transparent\),/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*--tutorial-target-contained-peak-shadow:[\s\S]*0 0 0 9px color-mix\(in oklab,\s*var\(--tutorial-highlight-accent\) 32%,\s*transparent\),/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.app-main:has\(\.tutorial-target-active\)::before,[\s\S]*background:\s*color-mix\(in oklab,\s*black 38%,\s*transparent\);/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.tutorial-target-active::after\s*\{[^}]*padding:\s*5px 8px;[^}]*font-size:\s*11px;[^}]*box-shadow:\s*0 4px 10px color-mix\(in oklab,\s*black 18%,\s*transparent\);/s);
});

test('fourteen inch mac demo viewport compresses the drum sequencer without internal scroll', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.drum-seq-body\s*\{[^}]*padding:\s*6px 0 8px;[^}]*overflow:\s*hidden;/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.track-editor-pager-content\s*\{[^}]*gap:\s*4px;/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.drum-seq-panel\s*\{[^}]*--drum-step-size:\s*clamp\(34px,\s*calc\(\(var\(--app-editor-height\) - 104px\) \/ 4\.2\),\s*42px\);[^}]*--drum-row-gap:\s*clamp\(5px,\s*calc\(\(var\(--app-editor-height\) - 236px\) \/ 12\),\s*10px\);/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.drum-sequencer-grid\s*\{[^}]*--drum-group-header-height:\s*26px;[^}]*grid-template-columns:\s*124px minmax\(0,\s*1fr\);[^}]*gap:\s*8px;/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.drum-step-group\s*\{[^}]*--drum-step-gap:\s*4px;[^}]*padding:\s*var\(--drum-group-padding\);/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.drum-step\s*\{[^}]*width:\s*var\(--drum-step-size\);[^}]*height:\s*var\(--drum-step-size\);[^}]*min-height:\s*var\(--drum-step-size\);/s);
});

test('fourteen inch mac demo viewport gives editor chrome deterministic truncation', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const drumEditorSource = await readFile(new URL('../src/app/components/DrumSequencer.jsx', import.meta.url), 'utf8');

  assert.doesNotMatch(drumEditorSource, /为本小节生成基础律动|全局生成基础律动|清空本小节|清空整轨/);
  assert.match(drumEditorSource, /选择律动模板/);
  assert.match(drumEditorSource, /应用到本小节/);
  assert.match(drumEditorSource, /应用到整轨/);
  assert.doesNotMatch(drumEditorSource, />\s*生成本小节\s*</);
  assert.doesNotMatch(drumEditorSource, />\s*生成全局\s*</);
  assert.match(drumEditorSource, /清本小节/);
  assert.match(drumEditorSource, /清整轨/);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.editor-head\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) max-content;/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.editor-left\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(104px,\s*116px\) minmax\(0,\s*1fr\);[^}]*overflow:\s*hidden;/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.tools\s*\{[^}]*justify-content:\s*end;[^}]*max-width:\s*min\(610px,\s*52vw\);/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.editor-track-identity\s*\{[^}]*grid-template-columns:\s*32px minmax\(0,\s*1fr\);[^}]*width:\s*104px;[^}]*max-width:\s*104px;/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.crumb,\s*\n\s*\.clip-name-meta,\s*\n\s*\.clip-name-input\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s);
});

test('timeline clips fill exactly one bar grid cell', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.clip\s*\{[^}]*left:\s*0;/s);
  assert.match(css, /\.clip\s*\{[^}]*left:\s*calc\(var\(--bar-index\) \* 100% \/ var\(--bars\)\);/s);
  assert.match(css, /\.clip\s*\{[^}]*width:\s*calc\(100% \/ var\(--bars\)\);/s);
  assert.match(css, /\.clip\s*\{[^}]*top:\s*var\(--timeline-clip-y-inset\);/s);
  assert.match(css, /\.clip\s*\{[^}]*bottom:\s*var\(--timeline-clip-y-inset\);/s);
  assert.match(css, /\.clip\s*\{[^}]*box-sizing:\s*border-box;/s);
  assert.match(css, /\.clip\s*\{[^}]*min-width:\s*0;/s);
  assert.match(css, /\.bar-drop-zone\s*\{[^}]*top:\s*var\(--timeline-clip-y-inset\);/s);
  assert.match(css, /\.bar-drop-zone\s*\{[^}]*bottom:\s*var\(--timeline-clip-y-inset\);/s);
  assert.match(css, /\.bar-drop-zone\s*\{[^}]*left:\s*calc\(var\(--bar-index\) \* 100% \/ var\(--bars\) \+ var\(--timeline-bar-x-inset\)\);/s);
  assert.match(css, /\.bar-drop-zone\s*\{[^}]*width:\s*calc\(100% \/ var\(--bars\) - var\(--timeline-bar-x-inset\) - var\(--timeline-bar-x-inset\)\);/s);
  assert.match(css, /\.ruler\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--bars\),\s*minmax\(80px,\s*1fr\)\);/s);
  assert.match(css, /\.ruler\s*\{[^}]*min-width:\s*var\(--timeline-min-width\);/s);
  assert.match(css, /\.grid\s*\{[^}]*min-width:\s*var\(--timeline-min-width\);/s);
  assert.match(css, /\.add-clip\s*\{[^}]*left:\s*calc\(\(var\(--bar-index\) \+ 0\.5\) \* 100% \/ var\(--bars\)\);/s);
  assert.match(css, /\.add-clip\s*\{[^}]*transform:\s*translate\(-50%, -50%\);/s);
  assert.doesNotMatch(css, /\.clip\s*\{[^}]*\+ 10px/s);
  assert.doesNotMatch(css, /\.clip\s*\{[^}]*- 20px/s);
  assert.doesNotMatch(css, /\.clip\s*\{[^}]*top:\s*6px;/s);
  assert.doesNotMatch(css, /\.clip\s*\{[^}]*bottom:\s*6px;/s);
  assert.doesNotMatch(css, /\.bar-drop-zone\s*\{[^}]*top:\s*6px;/s);
  assert.doesNotMatch(css, /\.bar-drop-zone\s*\{[^}]*bottom:\s*6px;/s);
  assert.doesNotMatch(css, /\.clip-mini\s*\{/);
  assert.doesNotMatch(css, /var\(--bars\) \* 1\.55/);
});

test('timeline playhead spans ruler and track grid', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.ruler\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/s);
  assert.match(css, /\.ruler-playhead,\s*\n\.playhead\s*\{[^}]*position:\s*absolute;/s);
  assert.match(css, /\.ruler-playhead,\s*\n\.playhead\s*\{[^}]*width:\s*2px;/s);
  assert.match(css, /\.ruler-playhead\s*\{[^}]*top:\s*0;/s);
  assert.match(css, /\.ruler-playhead\s*\{[^}]*bottom:\s*-1px;/s);
  assert.match(css, /\.ruler-playhead\s*\{[^}]*background:\s*transparent;/s);
  assert.match(css, /\.ruler-playhead::before\s*\{[^}]*position:\s*absolute;[^}]*top:\s*0;[^}]*bottom:\s*8px;[^}]*left:\s*0;[^}]*width:\s*2px;[^}]*pointer-events:\s*none;/s);
  assert.match(css, /\.ruler-playhead::before\s*\{[^}]*background:\s*color-mix\(in oklab,\s*var\(--brand\) 65%,\s*black\);/s);
  assert.match(css, /\.playhead\s*\{[^}]*top:\s*0;/s);
  assert.match(css, /\.playhead\s*\{[^}]*bottom:\s*0;/s);
  assert.match(css, /\.playhead-hit\s*\{[^}]*width:\s*14px;/s);
  assert.match(css, /\.playhead-hit\s*\{[^}]*cursor:\s*ew-resize;/s);
  assert.match(css, /\.playhead-hit\s*\{[^}]*background:\s*transparent;/s);
  assert.match(css, /\.timeline-col\.playhead-dragging\s*\{[^}]*cursor:\s*grabbing;/s);
});

test('editor resize handle overlays the workspace editor boundary', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.app-main\s*\{[^}]*grid-template-rows:\s*var\(--app-topbar-height\) minmax\(0,\s*1fr\) var\(--app-editor-height\);/s);
  assert.match(css, /\.app-main\s*\{[^}]*position:\s*relative;/s);
  assert.match(css, /\.editor-resizer\s*\{[^}]*position:\s*absolute;/s);
  assert.match(css, /\.editor-resizer\s*\{[^}]*right:\s*0;/s);
  assert.match(css, /\.editor-resizer\s*\{[^}]*bottom:\s*var\(--app-editor-height\);/s);
  assert.match(css, /\.editor-resizer\s*\{[^}]*height:\s*12px;/s);
  assert.match(css, /\.editor-resizer\s*\{[^}]*cursor:\s*ns-resize;/s);
  assert.match(css, /\.editor-resizer::before\s*\{[^}]*height:\s*1px;/s);
  assert.match(css, /\.editor-resizer-grip\s*\{[^}]*width:\s*44px;/s);
  assert.match(css, /\.editor-resizer-grip\s*\{[^}]*height:\s*4px;/s);
  assert.match(css, /\.editor-resizer-grip\s*\{[^}]*border-radius:\s*999px;/s);
  assert.match(css, /\.editor-resizer:hover \.editor-resizer-grip,\s*\n\.app\.editor-resizing \.editor-resizer-grip\s*\{/s);
  assert.match(css, /\.app\.editor-resizing\s*\{[^}]*user-select:\s*none;/s);
  assert.match(css, /\.app\.editor-resizing \.editor-resizer\s*\{[^}]*cursor:\s*ns-resize;/s);
});

test('track list rows align with timeline hover rows', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /--track-row-min-height:\s*90px;/);
  assert.match(css, /--tutorial-footer-height:\s*48px;/);
  assert.doesNotMatch(css, /--track-footer-height:/);
  assert.match(css, /\.tracks-col\s*\{[^}]*grid-template-rows:\s*48px minmax\(0,\s*1fr\);/s);
  assert.match(css, /\.timeline-col\s*\{[^}]*grid-template-rows:\s*48px minmax\(0,\s*1fr\);/s);
  assert.doesNotMatch(css, /\.timeline-footer-spacer\s*\{/);
  assert.match(css, /\.tracks-list\s*\{[^}]*grid-template-rows:\s*repeat\(\s*var\(--track-count,\s*4\),\s*minmax\(var\(--track-row-min-height\),\s*1fr\)\s*\);/s);
  assert.match(css, /\.tracks-list\s*\{[^}]*align-content:\s*stretch;/s);
  assert.match(css, /\.tracks-list\s*\{[^}]*overflow:\s*auto;/s);
  assert.match(css, /\.grid-rows,\s*\n\.hover-rows\s*\{[^}]*grid-template-rows:\s*repeat\(\s*var\(--track-count,\s*4\),\s*minmax\(var\(--track-row-min-height\),\s*1fr\)\s*\);/s);
  assert.match(css, /\.hover-row\s*\{[^}]*position:\s*relative;/s);
  assert.doesNotMatch(css, /\.hover-row\s*\{[^}]*height:\s*var\(--timeline-clip-y-inset\);/s);
  assert.doesNotMatch(css, /\.hover-row\s*\{[^}]*top:\s*var\(--timeline-clip-y-inset\);/s);
  assert.doesNotMatch(css, /\.hover-row\s*\{[^}]*bottom:\s*var\(--timeline-clip-y-inset\);/s);
  assert.match(css, /\.grid\s*\{[^}]*height:\s*max\(100%,\s*calc\(var\(--track-count,\s*4\) \* var\(--track-row-min-height\)\)\);/s);
  assert.match(css, /\.timeline-marquee-selection\s*\{[^}]*top:\s*calc\(var\(--selection-start-track\) \* 100% \/ var\(--track-count,\s*4\)\);/s);
  assert.match(css, /\.timeline-marquee-selection\s*\{[^}]*height:\s*calc\(var\(--selection-track-count\) \* 100% \/ var\(--track-count,\s*4\)\);/s);
  assert.doesNotMatch(css, /linear-gradient\(to bottom,[^;]*var\(--track-row/s);
  assert.doesNotMatch(css, /min-height:\s*74px;/);
});

test('timeline clips and add controls inherit the left track color map', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  for (const trackId of TRACK_IDS) {
    assert.match(css, new RegExp(`\\[data-type="${trackId}"\\]\\s*\\{[^}]*--track-color:\\s*var\\(--c-${trackId}\\);`, 's'));
    assert.match(css, new RegExp(`\\[data-type="${trackId}"\\]\\s*\\{[^}]*--track-ink:\\s*var\\(--c-${trackId}-ink\\);`, 's'));
  }

  assert.match(css, /\.clip\s*\{[^}]*--clip-bg:\s*var\(--track-color,\s*var\(--c-drums\)\);/s);
  assert.match(css, /\.clip\s*\{[^}]*--clip-ink:\s*var\(--track-ink,\s*var\(--c-drums-ink\)\);/s);
  assert.match(css, /\.add-clip\s*\{[^}]*color:\s*var\(--track-ink,\s*var\(--ink-3\)\);/s);
  assert.match(css, /\.add-clip\s*\{[^}]*background:\s*color-mix\(in oklab,\s*var\(--track-color,\s*var\(--surface\)\)/s);
});

test('timeline clips keep their nine-slice gems inside one shared dark corner mask', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  for (const trackId of TRACK_IDS) {
    assert.match(css, new RegExp(`\\.clip\\[data-type="${trackId}"\\]\\s*\\{[^}]*--clip-skin:\\s*var\\(--asset-clip-${trackId}\\);`, 's'));
  }

  assert.match(css, /\.clip\s*\{[^}]*isolation:\s*isolate;/s);
  assert.match(css, /\.clip\s*\{[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.clip\s*\{[^}]*background:[^}]*var\(--clip-bg\)/s);
  assert.match(css, /\.clip\s*\{[^}]*--clip-skin-inset:\s*1px;/s);
  assert.match(css, /\.clip\s*\{[^}]*--clip-skin-radius:\s*11px;/s);
  assert.match(css, /\.clip\s*\{[^}]*--clip-skin-scale:\s*1;/s);
  assert.match(css, /\.clip\s*\{[^}]*color-mix\(in oklab,\s*#030202 82%,\s*var\(--clip-bg\)\)/s);
  assert.match(css, /\.clip\[data-type="chord"\]\s*\{[^}]*--clip-skin-scale:\s*1\.08;/s);
  assert.match(css, /\.clip::before\s*\{[^}]*content:\s*"";/s);
  assert.match(css, /\.clip::before\s*\{[^}]*inset:\s*var\(--clip-skin-inset\);/s);
  assert.match(css, /\.clip::before\s*\{[^}]*border-image-source:\s*var\(--clip-skin\);/s);
  assert.match(css, /\.clip::before\s*\{[^}]*border-image-slice:\s*128 fill;/s);
  assert.match(css, /\.clip::before\s*\{[^}]*border-image-width:\s*18px;/s);
  assert.match(css, /\.clip::before\s*\{[^}]*border-radius:\s*var\(--clip-skin-radius\);/s);
  assert.match(css, /\.clip::before\s*\{[^}]*clip-path:\s*inset\(0 round var\(--clip-skin-radius\)\);/s);
  assert.match(css, /\.clip::before\s*\{[^}]*transform:\s*scale\(var\(--clip-skin-scale\)\);/s);
  assert.doesNotMatch(css, /\.clip::before\s*\{[^}]*background-image:/s);
  assert.match(css, /\.clip::before\s*\{[^}]*filter:\s*drop-shadow/s);
  assert.match(css, /\.clip::after\s*\{[^}]*content:\s*"";/s);
  assert.match(css, /\.clip::after\s*\{[^}]*box-shadow:\s*inset 0 0 0 1px/s);
  assert.match(css, /\.clip-copy\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*1;/s);
});

test('track fill-empty clip button is compact and inherits track color', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.track-main-row\s*\{[^}]*grid-template-columns:\s*minmax\(76px,\s*1fr\) minmax\(0,\s*auto\);/s);
  assert.match(css, /\.track-select\s*\{[^}]*grid-template-columns:\s*38px minmax\(0,\s*1fr\);/s);
  assert.match(css, /\.track-select\s*\{[^}]*min-width:\s*76px;/s);
  assert.match(css, /\.ic\s*\{[^}]*min-width:\s*32px;/s);
  assert.match(css, /\.ic\s*\{[^}]*flex:\s*0 0 32px;/s);
  assert.match(css, /\.track\s*\{[^}]*grid-template-rows:\s*36px 18px;[^}]*gap:\s*4px;/s);
  assert.match(css, /\.track-main-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) 54px;/s);
  assert.match(css, /\.track-select\s*\{[^}]*min-width:\s*0;/s);
  assert.match(css, /\.track-name\s*\{[^}]*min-width:\s*0;/s);
  assert.match(css, /@media\s*\(max-width:\s*980px\)\s*\{[\s\S]*\.track\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s);
  assert.match(css, /@media\s*\(max-width:\s*980px\)\s*\{[\s\S]*\.track-main-row,\s*\n\s*\.vol\s*\{[^}]*grid-column:\s*1;/s);
  assert.match(css, /\.fill-empty-clips\s*\{[^}]*height:\s*28px;/s);
  assert.match(css, /\.fill-empty-clips\s*\{[^}]*min-width:\s*0;/s);
  assert.match(css, /\.fill-empty-clips\s*\{[^}]*max-width:\s*96px;/s);
  assert.match(css, /\.fill-empty-clips\s*\{[^}]*color:\s*var\(--track-ink,\s*var\(--ink-3\)\);/s);
  assert.match(css, /\.fill-empty-clips\s*\{[^}]*background:\s*color-mix\(in oklab,\s*var\(--track-color,\s*var\(--surface\)\)/s);
  assert.match(css, /\.fill-empty-clips-label\s*\{[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.fill-empty-clips-label\s*\{[^}]*text-overflow:\s*ellipsis;/s);
  assert.match(css, /\.fill-empty-clips:hover:not\(:disabled\),\s*\n\.fill-empty-clips:focus-visible:not\(:disabled\)\s*\{/s);
  assert.match(css, /\.fill-empty-clips-icon\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*4px\);/s);
  assert.match(css, /\.fill-empty-clips-icon span\s*\{[^}]*background:\s*currentColor;/s);
  assert.match(css, /\.fill-gem\s*\{[^}]*box-shadow:[^}]*0 0 5px color-mix\(in oklab,\s*var\(--track-color\) 36%,\s*transparent\),[^}]*0 2px 4px rgb\(0 0 0 \/ 0\.46\);/s);
});

test('editor track identity reuses the full track-select button styling safely', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.editor-track-identity\s*\{[^}]*grid-template-columns:\s*48px minmax\(0,\s*1fr\);/s);
  assert.match(css, /\.editor-track-identity\s*\{[^}]*width:\s*clamp\(118px,\s*13vw,\s*168px\);/s);
  assert.match(css, /\.editor-track-identity\s*\{[^}]*max-width:\s*min\(34vw,\s*178px\);/s);
  assert.match(css, /\.editor-track-identity\s*\{[^}]*pointer-events:\s*none;/s);
  assert.match(css, /\.editor-track-identity\s*\{[^}]*cursor:\s*default;/s);
  assert.match(css, /\.editor-track-identity \.ic\s*\{[^}]*width:\s*42px;[^}]*min-width:\s*42px;/s);
  assert.match(css, /\.editor-track-identity \.track-name\s*\{[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s);
  assert.match(css, /@media\s*\(max-width:\s*980px\)\s*\{[\s\S]*\.editor-track-identity\s*\{[^}]*width:\s*clamp\(104px,\s*28vw,\s*142px\);/s);
  assert.doesNotMatch(css, /\.editor-track-identity\s*\{[^}]*cursor:\s*pointer;/s);
});

test('bass and melody fill track gems use their track colors', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.track\[data-type="bass"\] \.fill-gem\s*\{[^}]*var\(--asset-gem-blue\)[^}]*var\(--c-bass\)[^}]*var\(--c-bass-ink\)/s);
  assert.match(css, /\.track\[data-type="melody"\] \.fill-gem\s*\{[^}]*var\(--asset-gem-purple\)[^}]*var\(--c-melody\)[^}]*var\(--c-melody-ink\)/s);
});

test('timeline drag and swap feedback is visually prominent', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.clip\.clip-dragging\s*\{[^}]*transform:\s*translateY\(-3px\) scale\(1\.02\);/s);
  assert.match(css, /\.clip\.drop-move,\s*\n\.clip\.drop-swap\s*\{[^}]*animation:\s*clip-drop-pop 0\.48s ease-out;/s);
  assert.match(css, /\.bar-drop-zone\.drag-over\s*\{[^}]*box-shadow:\s*inset 0 0 0 2px/s);
  assert.match(css, /\.bar-drop-zone\.drop-move,\s*\n\.bar-drop-zone\.drop-swap\s*\{[^}]*animation:\s*bar-drop-pulse 0\.7s ease-out;/s);
  assert.match(css, /@keyframes clip-drop-pop/);
  assert.match(css, /@keyframes bar-drop-pulse/);
});

test('drum sequencer uses four hardware beat frames and sixteen stable step positions', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  for (const [assetPath, width, height, colorType] of DRUM_PNG_SPECS) {
    const png = await readPngInfo(assetPath);
    assert.equal(png.width, width);
    assert.equal(png.height, height);
    assert.equal(png.colorType, colorType);
  }

  assert.match(css, /\.app:has\(\.editor\[data-screen-label="Drum Sequencer"\]:not\(\[data-picker="drum-template"\]\)\)\s*\{[^}]*--app-editor-height:\s*clamp\(420px,\s*54vh,\s*560px\);/s);
  assert.match(css, /\.drum-seq-body\s*\{[^}]*overflow:\s*auto;[^}]*padding:\s*14px 0;/s);
  assert.match(css, /\.track-editor-pager-shell\s*\{[^}]*grid-template-columns:\s*72px minmax\(0,\s*1fr\) 72px;/s);
  assert.match(css, /\.track-editor-pager-shell\s*\{[^}]*align-items:\s*center;/s);
  assert.match(css, /\.track-editor-pager-shell\s*\{[^}]*--track-page-btn-inset:\s*clamp\(12px,\s*1\.4vw,\s*22px\);/s);
  assert.match(css, /\.track-editor-pager-shell\s*\{[^}]*padding-inline:\s*var\(--track-page-btn-inset\);/s);
  assert.match(css, /\.drum-seq-body \.track-editor-pager-shell,\s*\n\.drum-seq-body \.track-editor-pager-content\s*\{[^}]*height:\s*100%;/s);
  assert.doesNotMatch(css, /\.drum-seq-body \.track-editor-pager-shell[^}]*grid-template-columns:/s);
  assert.match(css, /\.drum-seq-panel\s*\{[^}]*--drum-step-size:\s*clamp\(44px,\s*3\.2vw,\s*64px\);[^}]*justify-self:\s*center;[^}]*justify-content:\s*space-evenly;[^}]*gap:\s*0;[^}]*width:\s*100%;[^}]*height:\s*100%;/s);
  assert.doesNotMatch(css, /\.drum-seq-panel\s*\{[^}]*max-width:/s);
  assert.match(css, /@media\s*\(max-width:\s*980px\)\s*\{[\s\S]*\.track-editor-pager-shell\s*\{[^}]*--track-page-btn-inset:\s*8px;/s);
  assert.match(css, /@media\s*\(max-width:\s*980px\)\s*\{[\s\S]*\.drum-seq-body\s*\{[^}]*padding:\s*16px 0;/s);
  assert.match(css, /\.drum-sequencer-grid\s*\{[^}]*--drum-group-header-height:\s*30px;[^}]*grid-template-columns:\s*124px minmax\(0,\s*1fr\);[^}]*gap:\s*12px;[^}]*align-self:\s*center;[^}]*width:\s*82%;[^}]*min-width:\s*min\(100%,\s*940px\);/s);
  assert.match(css, /\.drum-row-labels\s*\{[^}]*grid-template-rows:\s*var\(--drum-group-header-height\) repeat\(3,\s*var\(--drum-step-size\)\);[^}]*gap:\s*var\(--drum-row-gap\);/s);
  assert.match(css, /\.drum-step-groups\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);[^}]*justify-content:\s*stretch;[^}]*gap:\s*var\(--drum-step-group-gap\);[^}]*justify-self:\s*stretch;[^}]*width:\s*100%;[^}]*min-width:\s*0;/s);
  assert.match(css, /\.drum-step-groups\s*\{[^}]*--drum-step-group-gap:\s*clamp\(10px,\s*1\.8vw,\s*18px\);/s);
  assert.match(css, /\.drum-step-group\s*\{[^}]*--drum-step-gap:\s*5px;/s);
  assert.match(css, /\.drum-step-group\s*\{[^}]*grid-template-rows:\s*var\(--drum-group-header-height\) repeat\(3,\s*var\(--drum-step-size\)\);[^}]*gap:\s*var\(--drum-row-gap\);[^}]*padding:\s*var\(--drum-group-padding\);[^}]*background-image:\s*var\(--asset-grid-panel\);[^}]*border:\s*1px solid color-mix\(in oklab,\s*var\(--hardware-copper,\s*#b87845\) 66%,\s*#2a170d\);[^}]*border-radius:\s*9px;/s);
  assert.match(css, /\.drum-beat-position-row,\s*\n\.drum-beat-row\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);[^}]*gap:\s*var\(--drum-step-gap\);/s);
  assert.match(css, /\.drum-beat-label\s*\{[^}]*color:\s*var\(--hardware-gold,\s*#d7b06d\);[^}]*letter-spacing:\s*0\.14em;/s);
  assert.doesNotMatch(css, /\.drum-step(?:-number)?\.beat-end\s*\{[^}]*margin-right:/s);
  assert.match(css, /\.track-page-btn\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /\.track-page-btn\s*\{[^}]*flex-direction:\s*column;/s);
  assert.match(css, /\.track-page-btn\s*\{[^}]*width:\s*72px;/s);
  assert.match(css, /\.track-page-btn\s*\{[^}]*height:\s*128px;/s);
  assert.match(css, /\.track-page-btn\s*\{[^}]*color:\s*var\(--track-ink,\s*var\(--c-drums-ink\)\);/s);
  assert.match(css, /\.track-page-btn:hover:not\(:disabled\)\s*\{[^}]*background:\s*var\(--track-ink,\s*var\(--c-drums-ink\)\);/s);
  assert.match(css, /\.track-page-btn:disabled\s*\{[^}]*opacity:\s*0\.32;/s);
  assert.match(css, /\.track-page-btn-label\s*\{[^}]*font-size:\s*20px;/s);
  assert.match(css, /\.track-page-btn-kind\s*\{[^}]*font-family:\s*ui-monospace,/s);
  assert.doesNotMatch(css, /\.drum-editor \.btn-template,\s*\n\.drum-editor \.drum-clear-action\s*\{[^}]*--asset-drum-control-button/s);
  assert.doesNotMatch(css, /\.drum-editor \.btn-template:hover:not\(:disabled\),\s*\n\.drum-editor \.drum-action:hover:not\(:disabled\)\s*\{/s);
  assert.doesNotMatch(css, /\.drum-editor \.btn-template:disabled,\s*\n\.drum-editor \.drum-action:disabled\s*\{/s);
  assert.doesNotMatch(css, /\.drum-editor \.track-page-btn(?::hover:not\(:disabled\)|:disabled)?\s*\{[^}]*--asset-drum-page-button/s);
  assert.doesNotMatch(css, /\.drum-editor \.editor-close\s*\{[^}]*--asset-drum-close-button/s);
  assert.doesNotMatch(css, /\.drum-action\s*\{[^}]*background:/s);
  assert.match(css, /\.btn-template,\s*\n\.btn-template-groove,\s*\n\.drum-clear-action,\s*\n\.btn-template-active,\s*\n\.btn-template-groove-active,\s*\n\.btn-template-scale-active\s*\{[^}]*var\(--asset-brass\) center \/ cover/s);
  assert.match(css, /\.editor-close,\s*\n\.track-page-btn,\s*\n\.tool-icon\s*\{[^}]*var\(--asset-brass\) center \/ cover/s);
  assert.doesNotMatch(css, /\.drum-page-btn\s*\{/);
  assert.match(css, /\.drum-row-label\s*\{[^}]*white-space:\s*nowrap;/s);
  assert.match(css, /\.drum-dot\s*\{[^}]*flex:\s*0 0 32px;/s);
  assert.match(css, /\.drum-dot\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;/s);
  assert.match(css, /\.drum-dot\[data-instrument="kick"\]\s*\{[^}]*var\(--asset-drum-step-kick-on\)/s);
  assert.match(css, /\.drum-dot\[data-instrument="snare"\]\s*\{[^}]*var\(--asset-drum-step-snare-on\)/s);
  assert.match(css, /\.drum-dot\[data-instrument="hihat"\]\s*\{[^}]*var\(--asset-drum-step-hihat-on\)/s);
  assert.doesNotMatch(css, /\.drum-dot\[data-instrument="kick"\]\s*\{[^}]*color-mix/s);
  assert.match(css, /\.drum-step-number\s*\{[^}]*justify-content:\s*center;[^}]*height:\s*16px;/s);
  assert.doesNotMatch(css, /\.drum-step-group:not\(:last-child\)::after\s*\{/s);
  assert.doesNotMatch(css, /\.drum-step(?:-number)?\.beat-end::after\s*\{/s);
  assert.match(css, /\.drum-step\s*\{[^}]*justify-self:\s*center;[^}]*width:\s*min\(100%,\s*var\(--drum-step-size\)\);[^}]*height:\s*var\(--drum-step-size\);/s);
  assert.match(css, /\.drum-step\s*\{[^}]*var\(--asset-drum-step-off\)/s);
  assert.doesNotMatch(css, /\.drum-step\s*\{[^}]*linear-gradient/s);
  assert.match(css, /\.drum-step:hover\s*\{[^}]*filter:\s*brightness\(1\.08\) saturate\(1\.08\);/s);
  assert.match(css, /\.drum-step:focus-visible\s*\{[^}]*outline:\s*2px solid color-mix\(in oklab,\s*var\(--track-ink,\s*var\(--c-drums-ink\)\) 64%,\s*white\);/s);
  assert.match(css, /\.drum-step\.active\[data-instrument="kick"\]\s*\{[^}]*var\(--asset-drum-step-kick-on\)/s);
  assert.match(css, /\.drum-step\.active\[data-instrument="snare"\]\s*\{[^}]*var\(--asset-drum-step-snare-on\)/s);
  assert.match(css, /\.drum-step\.active\[data-instrument="hihat"\]\s*\{[^}]*var\(--asset-drum-step-hihat-on\)/s);
  assert.match(css, /@media\s*\(max-width:\s*980px\)\s*\{[\s\S]*\.drum-sequencer-grid\s*\{[^}]*grid-template-columns:\s*92px minmax\(0,\s*1fr\);[^}]*align-self:\s*stretch;[^}]*width:\s*100%;[^}]*min-width:\s*0;/s);
  assert.match(css, /@media\s*\(max-width:\s*980px\)\s*\{[\s\S]*\.drum-step-groups\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(112px,\s*1fr\)\);[^}]*gap:\s*12px;[^}]*justify-self:\s*stretch;[^}]*width:\s*100%;[^}]*min-width:\s*0;/s);
  assert.match(css, /@media\s*\(min-width:\s*981px\) and \(max-width:\s*1179px\)\s*\{[\s\S]*\.drum-seq-body\s*\{[^}]*padding:\s*4px 0;/s);
  assert.match(css, /@media\s*\(min-width:\s*981px\) and \(max-width:\s*1179px\)\s*\{[\s\S]*\.drum-sequencer-grid\s*\{[^}]*--drum-group-header-height:\s*27px;[^}]*grid-template-columns:\s*104px minmax\(0,\s*1fr\);[^}]*align-self:\s*stretch;[^}]*width:\s*100%;[^}]*min-width:\s*0;/s);
  assert.match(css, /@media\s*\(min-width:\s*981px\) and \(max-width:\s*1179px\)\s*\{[\s\S]*\.drum-row-label\s*\{[^}]*font-size:\s*11px;[^}]*line-height:\s*1;/s);
  assert.match(css, /@media\s*\(min-width:\s*981px\) and \(max-width:\s*1179px\)\s*\{[\s\S]*\.drum-step-groups\s*\{[^}]*justify-self:\s*stretch;[^}]*width:\s*100%;[^}]*min-width:\s*0;/s);
  assert.match(css, /@media\s*\(min-width:\s*981px\) and \(max-width:\s*1179px\)\s*\{[\s\S]*\.drum-step-group\s*\{[^}]*--drum-step-gap:\s*4px;[^}]*padding:\s*var\(--drum-group-padding\);/s);
  assert.match(css, /@media\s*\(min-width:\s*1180px\) and \(max-width:\s*1512px\) and \(max-height:\s*760px\)\s*\{[\s\S]*\.drum-sequencer-grid\s*\{[^}]*width:\s*88%;[^}]*min-width:\s*min\(100%,\s*880px\);/s);
});

test('shared piano roll displays twelve complete rows and uses a transform-only indicator', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /--piano-roll-viewport-height:\s*220px;/);
  assert.match(css, /--piano-roll-total-rows:\s*36;/);
  assert.match(css, /--piano-roll-visible-rows:\s*12;/);
  assert.match(css, /--piano-roll-row-gap:\s*3px;/);
  assert.match(css, /--piano-roll-row-padding:\s*6px;/);
  assert.match(css, /--piano-roll-visible-gap-space:\s*33px;/);
  assert.match(css, /--piano-roll-visible-padding-space:\s*12px;/);
  assert.match(css, /--piano-roll-viewport-border-space:\s*2px;/);
  assert.match(css, /--piano-roll-row-height:\s*calc\([\s\S]*var\(--piano-roll-viewport-height\)[\s\S]*- var\(--piano-roll-viewport-border-space\)[\s\S]*- var\(--piano-roll-visible-padding-space\)[\s\S]*- var\(--piano-roll-visible-gap-space\)[\s\S]*\/ 12[\s\S]*\);/);
  assert.match(css, /--pitch-rail-head-height:\s*var\(--piano-roll-beat-head-height\);/);
  assert.match(css, /\.scale-rail\s*\{[^}]*grid-template-rows:\s*var\(--pitch-rail-head-height\) var\(--piano-roll-viewport-height\) 22px;/s);
  assert.match(css, /\.scale-rail\s*\{[^}]*gap:\s*var\(--piano-roll-beat-gap\);/s);
  assert.match(css, /\.pitch-grid-head-spacer\s*\{[^}]*height:\s*var\(--pitch-rail-head-height\);/s);
  assert.match(css, /\.pitch-grid-head-spacer\s*\{[^}]*flex:\s*0 0 var\(--pitch-rail-head-height\);/s);
  assert.doesNotMatch(css, /\.pitch-grid-head-spacer\s*\{[^}]*(?:margin|transform|position):/s);
  assert.match(css, /\.scale-notes-viewport\s*\{[^}]*height:\s*var\(--piano-roll-viewport-height\);/s);
  assert.match(css, /\.scale-notes-viewport\s*\{[^}]*overflow-y:\s*auto;/s);
  assert.match(css, /\.scale-notes\s*\{[^}]*grid-template-rows:\s*repeat\(var\(--piano-roll-total-rows\),\s*var\(--piano-roll-row-height\)\);/s);
  assert.match(css, /\.scale-notes\s*\{[^}]*gap:\s*var\(--piano-roll-row-gap\);/s);
  assert.match(css, /\.scale-notes\s*\{[^}]*padding:\s*var\(--piano-roll-row-padding\);/s);
  assert.match(css, /\.scale-notes\s*\{[^}]*align-content:\s*start;/s);
  assert.match(css, /\.note-key\s*\{[^}]*min-height:\s*0;/s);
  assert.match(css, /\.beat-cells-viewport\s*\{[^}]*height:\s*var\(--piano-roll-viewport-height\);/s);
  assert.match(css, /\.beat-cells-viewport\s*\{[^}]*overflow-y:\s*auto;/s);
  assert.match(css, /\.beat-cells\s*\{[^}]*grid-template-rows:\s*repeat\(var\(--piano-roll-total-rows\),\s*var\(--piano-roll-row-height\)\);/s);
  assert.match(css, /\.beat-cells\s*\{[^}]*gap:\s*var\(--piano-roll-row-gap\);/s);
  assert.match(css, /\.beat-cells\s*\{[^}]*padding:\s*var\(--piano-roll-row-padding\);/s);
  assert.match(css, /\.piano-roll-grid\s*\{[^}]*overflow-x:\s*auto;[^}]*overflow-y:\s*hidden;/s);
  assert.match(css, /\.piano-roll-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(128px,\s*1fr\)\);/s);
  assert.match(css, /\.piano-roll-row-indicator\s*\{[^}]*pointer-events:\s*none;/s);
  assert.match(css, /\.piano-roll-row-indicator\s*\{[^}]*transform:\s*translate3d\(0,\s*var\(--piano-roll-hover-y,\s*0\),\s*0\);/s);
  assert.match(css, /\.piano-roll-row-indicator\s*\{[^}]*transition:\s*opacity 50ms ease-in;/s);
  assert.match(css, /\.piano-roll\[data-row-indicator-visible="true"\] \.piano-roll-row-indicator\s*\{[^}]*transition-duration:\s*0ms;/s);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.piano-roll-row-indicator\s*\{[^}]*transition:\s*none;/s);
  assert.match(css, /\.pitch-step-cell\s*\{[^}]*transition:\s*none;/s);
  assert.doesNotMatch(css, /\.pitch-step-cell\s*\{[^}]*background:\s*oklch\(97% 0\.003 270\);/s);
  assert.match(css, /\.pitch-step-cell\s*\{[^}]*background:\s*\n\s*linear-gradient\(180deg,\s*rgb\(248 225 190 \/ 0\.92\),\s*rgb\(232 198 150 \/ 0\.88\)\);/s);
  assert.match(css, /\.pitch-step-cell\s*\{[^}]*border:\s*1px solid rgb\(84 48 24 \/ 0\.3\);/s);
  assert.match(css, /\.pitch-step-cell\s*\{[^}]*border-radius:\s*4px;/s);
  assert.match(css, /\.pitch-step-cell\s*\{[^}]*inset 0 1px 0 rgb\(255 244 218 \/ 0\.5\),\s*\n\s*inset 0 -5px 8px rgb\(78 40 16 \/ 0\.1\);/s);
  assert.match(css, /\.note-key\s*\{[^}]*background:\s*rgb\(255 248 232 \/ 0\.94\);/s);
  assert.doesNotMatch(css, /\.note-key\s*\{[^}]*linear-gradient/s);
  assert.doesNotMatch(css, /\.pitch-step-cell\.sharp\s*\{[^}]*background:/s);
  assert.doesNotMatch(css, /\.cell\.sharp\s*\{[^}]*background:/s);
  assert.match(css, /\.note-key\.sharp\s*\{[^}]*background:\s*rgb\(255 248 232 \/ 0\.94\);/s);
  assert.doesNotMatch(css, /\.note-key\.sharp\s*\{[^}]*linear-gradient/s);
  assert.doesNotMatch(css, /row-hovered|\.chord-grid|\.chord-cell/);
});

test('melody editor mirrors the reference keyboard strip and style picker layout', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.app:has\(\.editor\[data-screen-label="Melody Editor"\]:not\(\[data-picker="style"\]\)\)\s*\{[^}]*--app-editor-height:\s*clamp\(420px,\s*54vh,\s*560px\);/s);
  assert.match(css, /\.app:has\(\.editor\[data-picker="style"\]\)\s*\{[^}]*--app-editor-height:\s*clamp\(380px,\s*55vh,\s*560px\);/s);
  assert.match(css, /\.editor\[data-screen-label="Melody Editor"\]\s*\{[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\);/s);
  assert.match(css, /\.melody-editor-pager-shell\s*\{[^}]*align-items:\s*stretch;[^}]*min-height:\s*0;/s);
  assert.match(css, /\.melody-editor-pager-shell \.track-page-btn\s*\{[^}]*align-self:\s*center;/s);
  assert.match(css, /\.track-editor-pager-content\.melody-editor-scroll\s*\{[^}]*display:\s*grid;[^}]*grid-template-rows:\s*max-content;[^}]*align-content:\s*center;[^}]*min-height:\s*0;[^}]*gap:\s*0;[^}]*justify-content:\s*stretch;[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.track-editor-pager-content\.melody-editor-scroll\.has-input-dock\s*\{[^}]*grid-template-rows:\s*auto auto;/s);
  assert.match(css, /\.track-editor-pager-content\.melody-editor-scroll > \.keyboard-strip\s*\{[^}]*padding-top:\s*0;[^}]*padding-bottom:\s*0;/s);
  assert.match(css, /\.track-editor-pager-content\.melody-editor-scroll:has\(> \.melody-example-keys\)\s*\{[^}]*display:\s*flex;[^}]*gap:\s*4px;[^}]*justify-content:\s*flex-start;[^}]*overflow-y:\s*auto;[^}]*scrollbar-gutter:\s*stable;/s);
  assert.match(css, /\.melody-editor-scroll > \.melody-seq-body\s*\{[^}]*width:\s*100%;/s);
  assert.match(css, /\.editor-track-identity\s*\{[^}]*grid-template-columns:\s*48px minmax\(0,\s*1fr\);/s);
  assert.match(css, /\.keyboard-strip\s*\{[^}]*display:\s*block;/s);
  assert.match(css, /\.keyboard-strip\s*\{[^}]*padding:\s*2px 22px 2px 14px;/s);
  assert.doesNotMatch(css, /\.ks-intro\s*\{|\.ks-glyph\s*\{|\.ks-copy\s*\{|\.ks-scale\s*\{/s);
  assert.match(css, /\.ks-row\s*\{[^}]*grid-template-columns:\s*26px repeat\(8,\s*minmax\(0,\s*1fr\)\);[^}]*gap:\s*4px;/s);
  assert.match(css, /\.ks-octave\s*\{[^}]*place-items:\s*center;[^}]*font-size:\s*9px;/s);
  assert.doesNotMatch(css, /\.ks-key\s*\{[^}]*background:\s*oklch\(98% 0\.002 270\);/s);
  assert.match(css, /\.ks-key\s*\{[^}]*background:\s*\n\s*linear-gradient\(180deg,\s*rgb\(255 238 203 \/ 0\.94\)/s);
  assert.match(css, /\.ks-key\s*\{[^}]*border:\s*1px solid rgb\(99 57 25 \/ 0\.32\);/s);
  assert.match(css, /\.ks-key\s*\{[^}]*height:\s*26px;[^}]*gap:\s*4px;[^}]*padding:\s*2px 5px;/s);
  assert.match(css, /\.ks-letter\s*\{[^}]*background:\s*\n\s*linear-gradient\(180deg,\s*rgb\(67 48 36 \/ 0\.98\)/s);
  assert.match(css, /\.ks-divider\s*\{[^}]*font-size:\s*9px;/s);
  assert.match(css, /\.ks-note\s*\{[^}]*color:\s*#7a4a25;/s);
  assert.match(css, /\.ks-note \.oct\s*\{[^}]*color:\s*#a97948;/s);
  assert.match(css, /\.ks-keys\s*\{[^}]*grid-template-rows:\s*repeat\(3,\s*26px\);[^}]*gap:\s*2px;/s);
  assert.match(css, /\.ks-key\.scale-tone:not\(\.playing\)\s*\{[^}]*border-color:\s*var\(--c-melody-ink\);/s);
  assert.match(css, /\.ks-key\.playing\s*\{[^}]*background:\s*var\(--c-melody\);/s);
  assert.match(css, /\.ks-key\.disabled,[\s\S]*\.ks-key:disabled\s*\{[^}]*opacity:\s*0\.52;/s);
  assert.match(css, /\.melody-input-status-inline\s*\{[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s);
  assert.doesNotMatch(css, /\.melody-template-input-status\s*\{/s);
  assert.match(css, /\.piano-roll-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(128px,\s*1fr\)\);/s);
  assert.match(css, /\.melody-seq-body\s*\{[^}]*--piano-roll-beat-gap:\s*0px;[^}]*--pitch-rail-head-height:\s*20px;/s);
  assert.match(css, /\.melody-seq-body\s*\{[^}]*--piano-roll-viewport-height:\s*clamp\(\s*220px,\s*calc\(var\(--app-editor-height\) - 215px\),\s*345px\s*\);/s);
  assert.match(css, /@media\s*\(max-height:\s*720px\)\s*\{[\s\S]*?\.app:has\(\.editor\[data-screen-label="Melody Editor"\]:not\(\[data-picker="style"\]\)\)\s*\{[^}]*--app-editor-height:\s*clamp\(372px,\s*calc\(52vh \+ 12px\),\s*402px\);/s);
  assert.match(css, /@media\s*\(min-width:\s*981px\)\s*and\s*\(max-width:\s*1100px\)\s*and\s*\(max-height:\s*720px\)\s*\{[^}]*\.melody-seq-body\s*\{[^}]*--piano-roll-viewport-height:\s*218px;/s);
  assert.match(css, /@media\s*\(min-width:\s*981px\)\s*and\s*\(max-height:\s*720px\)\s*\{[^}]*\.melody-editor-scroll\.has-input-dock > \.melody-seq-body\s*\{[^}]*--piano-roll-viewport-height:\s*clamp\(/s);
  assert.match(css, /\.melody-seq-body\s*\{[^}]*--pitch-row-hover:\s*var\(--c-melody\);/s);
  assert.match(css, /\.melody-seq-body\s*\{[^}]*--pitch-row-hover-ink:\s*var\(--c-melody-ink\);/s);
  assert.match(css, /\.melody-seq-body \.scale-rail,\s*\n\.melody-seq-body \.piano-roll-grid\s*\{[^}]*padding-top:\s*0;[^}]*padding-bottom:\s*0;/s);
  assert.match(css, /\.melody-seq-body \.scale-rail\s*\{[^}]*grid-template-rows:\s*var\(--pitch-rail-head-height\)\s*var\(--piano-roll-viewport-height\)\s*var\(--pitch-rail-head-height\);/s);
  assert.match(css, /\.melody-seq-body \.scale-arrow\s*\{[^}]*height:\s*var\(--pitch-rail-head-height\);/s);
  assert.doesNotMatch(css, /--melody-pitch|--melody-rail-row/);
  assert.match(css, /\.beat-group\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*gap:\s*var\(--piano-roll-beat-gap\);/s);
  assert.doesNotMatch(css, /\.melody-beat-number-row\s*\{/);
  assert.doesNotMatch(css, /\.melody-cell\s*\{[^}]*background:\s*oklch\(97% 0\.003 270\);/s);
  assert.doesNotMatch(css, /\.melody-cell\s*\{[^}]*background:\s*\n\s*linear-gradient/s);
  assert.doesNotMatch(css, /\.melody-cell\.sharp\s*\{/);
  assert.doesNotMatch(css, /\.melody-cell\.downbeat\s*\{/);
  assert.match(css, /\.pitch-step-cell\s*\{[^}]*background:\s*\n\s*linear-gradient\(180deg,\s*rgb\(248 225 190 \/ 0\.92\)/s);
  assert.match(css, /\.melody-note-key\s*\{[^}]*background:\s*\n\s*linear-gradient\(180deg,\s*rgb\(248 225 190 \/ 0\.94\)/s);
  assert.match(css, /\.melody-note-key\.scale-tone:not\(\.playing\)\s*\{[^}]*background:\s*color-mix\(in oklab,\s*var\(--c-melody\) 58%,\s*#f0d5ad\);[^}]*inset 0 -1px 0/s);
  assert.match(css, /\.melody-cell\.scale-tone:not\(\.active\):not\(\.previewing\)\s*\{[^}]*background:\s*color-mix\(in oklab,\s*var\(--c-melody\) 44%,\s*#f0d5ad\);[^}]*inset 0 -1px 0/s);
  assert.match(css, /\.melody-cell\.active\s*\{[^}]*background:\s*var\(--c-melody\);/s);
  assert.match(css, /\.melody-cell\.previewing:not\(\.active\),\s*\n\.bass-cell\.previewing:not\(\.active\)\s*\{[^}]*background:\s*color-mix\(in oklab,\s*var\(--pitch-row-hover\) 52%,\s*#f0d5ad\);/s);
  assert.match(css, /\.melody-cell:not\(:disabled\):hover,\s*\n\.bass-cell:not\(:disabled\):hover\s*\{[^}]*background:\s*color-mix\(in oklab,\s*var\(--pitch-row-hover\) 38%,\s*#f0d5ad\);/s);
  assert.match(css, /\.melody-note-key\.playing\s*\{[^}]*background:\s*var\(--c-melody\)/s);
  assert.match(css, /\.scale-picker\s*\{[^}]*position:\s*absolute;/s);
  assert.match(css, /\.app-main:has\(\.tutorial-panel\) \.scale-picker:has\(\.sctpl-card\.tutorial-control-target\)\s*\{[^}]*z-index:\s*calc\(var\(--tutorial-target-z\) \+ 1\);/s);
  assert.match(css, /\.sctpl-card\s*\{[^}]*background:\s*\n\s*linear-gradient\(180deg,\s*rgb\(34 25 18 \/ 0\.96\),\s*rgb\(24 16 11 \/ 0\.94\)\),\s*\n\s*var\(--hardware-control-bg\);/s);
  assert.match(css, /\.sctpl-card\s*\{[^}]*border:\s*1px solid var\(--hardware-control-border\);/s);
  assert.match(css, /\.sctpl-name\s*\{[^}]*color:\s*var\(--hardware-chord-ink-strong\);/s);
  assert.match(css, /\.sctpl-desc\s*\{[^}]*color:\s*#e8c99a;/s);
  assert.match(css, /\.sctpl-foot-label\s*\{[^}]*color:\s*var\(--hardware-control-ink\);/s);
  assert.match(css, /\.sctpl-play\s*\{[^}]*color:\s*var\(--hardware-control-ink\);[^}]*background:\s*var\(--hardware-control-bg\);[^}]*border:\s*1px solid var\(--hardware-control-border\);/s);
  assert.doesNotMatch(css, /\.sctpl-play\s*\{[^}]*background:\s*var\(--play\)/s);
  assert.match(css, /\.sctpl-play:hover,\s*\n\.sctpl-play\.playing\s*\{[^}]*background:[\s\S]*rgb\(255 244 224 \/ 0\.2\)[\s\S]*var\(--hardware-control-bg\);/s);
  assert.doesNotMatch(css, /\.sctpl-play:hover,\s*\n\.sctpl-play\.playing\s*\{[^}]*var\(--play\)/s);
  assert.match(css, /\.sctpl-card\.selected\s*\{[^}]*background:[\s\S]*rgb\(42 30 21 \/ 0\.98\)[\s\S]*var\(--hardware-control-bg\);/s);
  assert.match(css, /\.sctpl-note\.scale-tone\s*\{[^}]*background:\s*rgb\(255 230 205 \/ 0\.24\);/s);
  assert.match(css, /\.sctpl-note:not\(\.scale-tone\)\s*\{[^}]*opacity:\s*0\.42;/s);
  assert.match(css, /\.sctpl-card\.tutorial-control-target\s*\{[^}]*--tutorial-highlight-accent:\s*rgb\(255 230 205 \/ 0\.82\);/s);
  assert.match(css, /\.sctpl-card\.tutorial-control-target\s*\{[^}]*background:[^}]*rgb\(34 25 18 \/ 0\.96\)[^}]*var\(--hardware-control-bg\);/s);
  assert.match(css, /\.sctpl-card\.tutorial-control-target\s*\{[^}]*border:\s*1px solid var\(--hardware-control-border\);/s);
  assert.doesNotMatch(css, /\.sctpl-card\.tutorial-control-target\s*\{[^}]*var\(--c-melody\)/s);
  assert.doesNotMatch(css, /\.sctpl-card\.tutorial-control-target\s*\{[^}]*var\(--tutorial-target-surface\)/s);
  assert.match(css, /\.sctpl-card\.tutorial-control-target\s*\{[^}]*z-index:\s*calc\(var\(--tutorial-target-z\) \+ 2\);/s);
  assert.match(css, /\.sctpl-card\.tutorial-control-target \.sctpl-notes\s*\{[^}]*background:\s*rgb\(16 9 6 \/ 0\.86\);/s);
  assert.match(css, /\.sctpl-card\.tutorial-control-target \.sctpl-note:not\(\.gap\)\s*\{[^}]*background:\s*rgb\(255 244 224 \/ 0\.12\);/s);
  assert.match(css, /\.scale-picker:has\(\.sctpl-card\.tutorial-control-target\) \.sctpl-card:not\(\.tutorial-control-target\)\s*\{[^}]*opacity:\s*0\.44;/s);
  assert.match(css, /\.app:has\(\.editor\[data-screen-label="Melody Editor"\]\[data-picker="style"\]\)\s*\{[^}]*--app-editor-height:\s*clamp\(480px,\s*62vh,\s*640px\);/s);
  assert.match(css, /\.melody-scale-workspace\s*\{[^}]*inset:\s*54px 0 0;[^}]*padding:\s*16px clamp\(16px,\s*1\.7vw,\s*24px\) 20px;[^}]*var\(--asset-wood\)/s);
  assert.match(css, /\.melody-scale-workspace-panel\s*\{[^}]*grid-template-rows:\s*46px minmax\(0,\s*1fr\);[^}]*var\(--asset-grid-panel\)/s);
  assert.match(css, /\.melody-scale-workspace-head\s*\{[^}]*justify-content:\s*space-between;[^}]*border-bottom:\s*1px solid rgb\(255 221 160 \/ 0\.18\);/s);
  assert.match(css, /\.melody-scale-workspace-icon-button\s*\{[^}]*width:\s*36px;[^}]*height:\s*36px;[^}]*var\(--asset-brass\)/s);
  assert.match(css, /\.melody-scale-workspace-body\s*\{[^}]*grid-template-columns:\s*178px minmax\(0,\s*1fr\);/s);
  assert.match(css, /\.melody-scale-options\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(css, /\.melody-timbre-section\s*\{[^}]*grid-template-columns:\s*124px minmax\(0,\s*1fr\);/s);
  assert.match(css, /\.melody-timbre-options\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(css, /\.melody-timbre-card\.selected\s*\{[^}]*border-color:\s*rgb\(255 220 153 \/ 0\.76\);/s);
  assert.match(css, /\.melody-style-actions > \.melody-style-preview-action\s*\{[^}]*color:\s*#d9bd94;[^}]*#28180f;/s);
  assert.match(css, /\.melody-scale-card\s*\{[^}]*border-radius:\s*10px;[^}]*text-align:\s*left;/s);
  assert.match(css, /\.melody-scale-card\.selected\s*\{[^}]*border-color:\s*rgb\(255 220 153 \/ 0\.82\);/s);
  assert.match(css, /\.melody-style-actions\s*\{[^}]*justify-content:\s*flex-end;/s);
  assert.match(css, /\.melody-style-mini-groove\s*\{[^}]*min-height:\s*34px;/s);
  assert.match(css, /@media\s*\(max-height:\s*720px\)\s*\{[\s\S]*?\.melody-timbre-card\s*\{[^}]*min-height:\s*44px;/s);
  assert.match(css, /\.melody-seq-body \.rhythm-step-ruler\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(css, /--c-melody:\s*#b889c4;/);
  assert.match(css, /--melody-amethyst:\s*#9870a8;/);
  assert.match(css, /\.melody-seq-body \.rhythm-step-marker\.highlighted::before\s*\{[^}]*var\(--melody-amethyst\)[^}]*rotate\(-45deg\);/s);
  assert.match(css, /\.melody-seq-body \.rhythm-step-marker\.highlighted::after\s*\{[^}]*height:\s*5px;[^}]*content:\s*"";/s);
  assert.match(css, /\.melody-cell\.rhythm-column::before\s*\{[^}]*left:\s*50%;[^}]*repeating-linear-gradient\([^}]*translateX\(-50%\);/s);
  assert.doesNotMatch(css, /\.melody-cell\.rhythm-column:not\(\.active\):not\(\.previewing\)\s*\{/s);
  assert.match(css, /@keyframes melody-rhythm-guide-pulse/);
  assert.match(css, /\.melody-style-mini-groove \.chord-template-mini-beat-group > span\.on\s*\{[^}]*var\(--melody-amethyst\)/s);
  assert.doesNotMatch(css, /\.melody-rhythm-mini-grid/);
  assert.match(css, /\.melody-example-keys\.tutorial-control-target\s*\{[^}]*background:\s*var\(--tutorial-target-surface\);[^}]*border-color:\s*var\(--tutorial-target-rim\);/s);
  assert.match(css, /\.melody-example-key\s*\{[^}]*display:\s*inline-flex;/s);
});

test('pitch rails and beat groups do not draw light wood panel backgrounds', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.scale-rail,\s*\n\.piano-roll-beat-group,\s*\n\.keyboard-strip,\s*\n\.melody-example-keys\s*\{[^}]*background:\s*transparent;/s);
  assert.match(css, /\.scale-rail,\s*\n\.piano-roll-beat-group,\s*\n\.keyboard-strip,\s*\n\.melody-example-keys\s*\{[^}]*border-color:\s*transparent;/s);
  assert.match(css, /\.scale-rail,\s*\n\.piano-roll-beat-group,\s*\n\.keyboard-strip,\s*\n\.melody-example-keys\s*\{[^}]*box-shadow:\s*none;/s);
  assert.doesNotMatch(css, /\.scale-rail,\s*\n\.piano-roll-beat-group,\s*\n\.keyboard-strip,\s*\n\.melody-example-keys\s*\{[^}]*var\(--asset-wood\)/s);
});

test('bass editor mirrors the reference piano-roll and groove picker layout', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.app:has\(\.editor\[data-screen-label="Bass Editor"\]:not\(\[data-picker="groove"\]\)\)\s*\{[^}]*--app-editor-height:\s*clamp\(420px,\s*54vh,\s*560px\);/s);
  assert.match(css, /\.editor-track-identity\s*\{[^}]*grid-template-columns:\s*48px minmax\(0,\s*1fr\);/s);
  assert.match(css, /\.scale-notes\s*\{[^}]*grid-template-rows:\s*repeat\(var\(--piano-roll-total-rows\),\s*var\(--piano-roll-row-height\)\);/s);
  assert.match(css, /\.beat-cells\s*\{[^}]*grid-template-rows:\s*repeat\(var\(--piano-roll-total-rows\),\s*var\(--piano-roll-row-height\)\);/s);
  assert.match(css, /\.bass-seq-body\s*\{[^}]*--pitch-rail-head-height:\s*22px;/s);
  assert.match(css, /\.bass-seq-body\s*\{[^}]*--piano-roll-viewport-height:\s*clamp\(\s*220px,\s*calc\(var\(--app-editor-height\) - 152px\),\s*408px\s*\);/s);
  assert.match(css, /@media\s*\(max-width:\s*980px\)\s*\{[\s\S]*?\.melody-seq-body\s*\{[^}]*--piano-roll-viewport-height:\s*clamp\(\s*214px,\s*calc\(var\(--app-editor-height\) - 265px\),\s*320px\s*\);/s);
  assert.match(css, /@media\s*\(max-width:\s*980px\)\s*\{[\s\S]*?\.bass-seq-body\s*\{[^}]*--piano-roll-viewport-height:\s*clamp\(\s*214px,\s*calc\(var\(--app-editor-height\) - 202px\),\s*358px\s*\);/s);
  assert.match(css, /\.bass-seq-body\s*\{[^}]*--pitch-row-hover:\s*var\(--c-bass\);/s);
  assert.match(css, /\.bass-seq-body\s*\{[^}]*--pitch-row-hover-ink:\s*var\(--c-bass-ink\);/s);
  assert.doesNotMatch(css, /\.bass-beat-number-row\s*\{/);
  assert.doesNotMatch(css, /\.bass-scale-notes\s*\{[^}]*grid-template-rows:\s*repeat\(12,/s);
  assert.doesNotMatch(css, /\.bass-beat-cells\s*\{[^}]*grid-template-rows:\s*repeat\(12,/s);
  assert.doesNotMatch(css, /\.bass-cell\s*\{[^}]*background:\s*rgb\(255 248 232 \/ 0\.94\);/s);
  assert.doesNotMatch(css, /\.bass-cell\s*\{[^}]*background:\s*\n\s*linear-gradient/s);
  assert.match(css, /\.bass-note-key\s*\{[^}]*background:\s*rgb\(255 248 232 \/ 0\.94\);/s);
  assert.doesNotMatch(css, /\.bass-note-key\s*\{[^}]*linear-gradient/s);
  assert.match(css, /\.bass-note-key\.root\s*\{[^}]*color:\s*var\(--c-bass-ink\);/s);
  assert.match(css, /\.bass-note-key:not\(:disabled\):hover\s*\{[^}]*background:\s*var\(--c-bass\);/s);
  assert.match(css, /\.bass-cell\.active\s*\{[^}]*background:\s*var\(--c-bass\);/s);
  assert.match(css, /\.melody-cell:not\(:disabled\):hover,\s*\n\.bass-cell:not\(:disabled\):hover\s*\{[^}]*background:\s*color-mix\(in oklab,\s*var\(--pitch-row-hover\) 38%,\s*#f0d5ad\);/s);
  assert.match(css, /\.app:has\(\.editor\[data-screen-label="Bass Editor"\]\[data-picker="groove"\]\)\s*\{[^}]*--app-editor-height:\s*clamp\(480px,\s*62vh,\s*640px\);/s);
  assert.match(css, /@media \(max-height:\s*720px\)\s*\{[\s\S]*?\.app:has\(\.editor\[data-screen-label="Bass Editor"\]\[data-picker="groove"\]\)\s*\{[^}]*--app-editor-height:\s*clamp\(360px,\s*52vh,\s*390px\);/s);
  assert.match(css, /\.bass-template-workspace-body\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\);/s);
  assert.match(css, /\.bass-template-groove-options\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(css, /\.bass-template-groove-options\s*\{[^}]*align-content:\s*center;/s);
  assert.match(css, /\.bass-template-groove-card\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\) auto;[^}]*#28180f;/s);
  assert.match(css, /\.bass-template-groove-card\.selected\s*\{[^}]*border-color:\s*rgb\(255 220 153 \/ 0\.82\);/s);
  assert.match(css, /\.bass-template-card-preview\s*\{[^}]*width:\s*36px;[^}]*height:\s*36px;/s);
  assert.match(css, /\.chord-template-mini-beat-group\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/s);
});

test('chord template workspace fits the editor at compact desktop heights', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.app:has\(\.editor\[data-screen-label="Chord Editor"\]:not\(\[data-picker="chord-workspace"\]\):not\(\[data-picker="chord"\]\):not\(\[data-picker="groove"\]\)\)\s*\{[^}]*--app-editor-height:\s*clamp\(420px,\s*54vh,\s*560px\);/s);
  assert.match(css, /\.app:has\(\.editor\[data-screen-label="Chord Editor"\]\[data-picker="chord-workspace"\]:not\(\[data-picker="chord"\]\):not\(\[data-picker="groove"\]\)\)\s*\{[^}]*--app-editor-height:\s*clamp\(480px,\s*62vh,\s*640px\);/s);
  assert.match(css, /@media \(max-height:\s*720px\)\s*\{[\s\S]*?\.app:has\(\.editor\[data-screen-label="Chord Editor"\]\[data-picker="chord-workspace"\]:not\(\[data-picker="chord"\]\):not\(\[data-picker="groove"\]\)\)\s*\{[^}]*--app-editor-height:\s*clamp\(360px,\s*52vh,\s*390px\);/s);
  assert.match(css, /\.chord-rhythm-panel\s*\{[^}]*overflow:\s*auto;[^}]*overscroll-behavior:\s*contain;/s);
  assert.match(css, /\.chord-template-workspace-body\s*\{[^}]*overflow:\s*auto;[^}]*overscroll-behavior:\s*contain;/s);
  assert.match(css, /\.chord-template-workspace-body\s*\{[^}]*grid-template-columns:\s*178px minmax\(0,\s*1fr\);/s);
  assert.match(css, /\.chord-template-progression-options,\s*\n\.chord-template-groove-options\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(css, /\.chord-style-groove-options\s*\{[^}]*align-content:\s*start;[^}]*min-height:\s*132px;/s);
  assert.match(css, /\.chord-template-workspace-body\.chord-style-selection-workspace-body\s*\{[^}]*grid-template-rows:\s*auto auto auto;[^}]*align-content:\s*start;/s);
  assert.match(css, /\.chord-style-selection-workspace-body \.chord-template-progression-options\s*\{[^}]*min-height:\s*132px;/s);
  assert.match(css, /\.chord-style-selection-workspace-body \.chord-template-progression-options > button,\s*\n\.chord-style-groove-options > button\s*\{[^}]*min-height:\s*132px;/s);
  assert.match(css, /@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.chord-template-workspace-body\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s);
  assert.match(css, /@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.chord-template-progression-options,\s*\n\s*\.chord-template-groove-options\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s);
  assert.match(css, /\.chord-template-workspace-actions\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /\.chord-rhythm-step-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(152px,\s*1fr\)\);/s);
  assert.match(css, /\.chord-rhythm-summary\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/s);
  assert.match(css, /\.chord-rhythm-summary-left\s*\{[^}]*display:\s*grid;[^}]*justify-self:\s*start;/s);
  assert.match(css, /\.chord-rhythm-progression-info\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*baseline;/s);
  assert.match(css, /\.chord-rhythm-readout\.next\s*\{[^}]*justify-self:\s*end;/s);
  assert.match(css, /\.chord-rhythm-sequencer-copy\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*baseline;/s);
  assert.match(css, /\.chord-rhythm-sequencer-head p\s*\{[^}]*margin:\s*0;[^}]*white-space:\s*nowrap;/s);
  assert.match(css, /\.chord-rhythm-beat-group\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(24px,\s*1fr\)\);/s);
  assert.match(css, /\.chord-rhythm-beat-group\s*\{[^}]*box-shadow:\s*[^}]*inset/s);
  assert.match(css, /\.chord-rhythm-step-label\s*\{[^}]*font-family:\s*Georgia/s);
  assert.match(css, /\.chord-step-harmony-popover\s*\{[^}]*position:\s*fixed;[^}]*z-index:\s*50;/s);
  assert.match(css, /\.chord-step-harmony-options\.enrich\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(css, /\.chord-step-harmony-option-preview\s*\{[^}]*width:\s*40px;[^}]*height:\s*40px;/s);
  assert.match(css, /\.chord-step-harmony-option-apply:disabled,\s*\n\.chord-step-harmony-option-preview:disabled\s*\{[^}]*cursor:\s*not-allowed;/s);
  assert.match(css, /\.chord-step-passing-availability\.is-restricted\s*\{[^}]*color:\s*#271507;[^}]*background:[^}]*#d68a34;[^}]*border-color:\s*#ffe0a4;[^}]*box-shadow:/s);
  assert.match(css, /\.chord-step-passing-availability\.is-restricted::before\s*\{[^}]*content:\s*"!";[^}]*background:\s*#3a1e09;/s);
  assert.match(css, /\.chord-step-passing-availability\.is-available\s*\{[^}]*color:\s*#c7a475;[^}]*box-shadow:\s*none;/s);
  assert.match(css, /\.chord-step-harmony-popover\[data-side="above"\]/);
  assert.match(css, /\.chord-template-mini-groove\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(css, /\.chord-template-mini-beat-group\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(css, /\.app:has\(\.editor\[data-picker="chord"\]\),\s*\n\.app:has\(\.editor\[data-picker="groove"\]\)\s*\{[^}]*--app-editor-height:\s*clamp\(380px,\s*55vh,\s*560px\);/s);
  assert.match(css, /\.tpl-body\s*\{[^}]*overflow:\s*auto;/s);
  assert.match(css, /\.tpl-list\s*\{[^}]*height:\s*auto;/s);
  assert.match(css, /\.tpl-list\s*\{[^}]*min-height:\s*100%;/s);
  assert.match(css, /\.tpl-confirm-overlay\s*\{[^}]*position:\s*absolute;/s);
  assert.match(css, /\.tpl-confirm-overlay\s*\{[^}]*inset:\s*0;/s);
  assert.match(css, /\.tpl-confirm-dialog\s*\{[^}]*display:\s*grid;/s);
  assert.match(css, /\.tpl-confirm-actions\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /\.tpl-confirm-cancel\s*\{[^}]*background:\s*var\(--surface\);/s);
  assert.match(css, /\.tpl-confirm-apply\s*\{[^}]*background:\s*var\(--ink\);/s);
  assert.doesNotMatch(css, /\.tpl-body\s*\{[^}]*overflow:\s*hidden;/s);
});

test('groove template picker mirrors the reference secondary menu layout', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.btn-template-groove\s*\{[^}]*display:\s*inline-flex;/s);
  assert.match(css, /\.btn-template-groove-active\s*\{[^}]*display:\s*inline-flex;/s);
  assert.match(css, /\.btn-template-groove-active\s*\{[^}]*align-items:\s*center;/s);
  assert.match(css, /\.btn-template-groove-active\s*\{[^}]*justify-content:\s*center;/s);
  assert.match(css, /\.gtpl-picker\s*\{[^}]*grid-template-rows:\s*48px 1fr 52px;/s);
  assert.match(css, /\.tpl-picker\s*\{[^}]*z-index:\s*8;/s);
  assert.match(css, /\.gtpl-picker\s*\{[^}]*z-index:\s*8;/s);
  assert.match(css, /\.drum-template-picker\s*\{[^}]*grid-template-rows:\s*48px 1fr 58px;/s);
  assert.match(css, /\.drum-template-list\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(240px,\s*1fr\)\);/s);
  assert.match(css, /\.drum-template-card\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /\.drum-template-card-footer\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /\.drum-template-preview\s*\{[^}]*display:\s*inline-flex;/s);
  assert.match(css, /\.drum-template-preview\.is-playing/);
  assert.match(css, /@media \(max-width:\s*1100px\)\s*\{[\s\S]*\.drum-template-list\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(css, /\.drum-template-beat-markers\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*58px minmax\(0,\s*1fr\);/s);
  assert.match(css, /\.drum-template-beat-marker-grid\s*\{[^}]*grid-template-columns:\s*repeat\(16,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(css, /\.drum-template-hit-label\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center;/s);
  assert.ok(
    css.lastIndexOf('.drum-template-step.hit-block::after') > css.lastIndexOf('.gtpl-step.hit-block::after'),
    'drum template hit markers must override generic groove hit blocks so hits stay lightweight',
  );
  assert.match(css, /\.drum-template-step\s*\{[^}]*overflow:\s*visible;/s);
  assert.match(css, /\.drum-template-step \.drum-template-hit-label\s*\{[^}]*display:\s*none;/s);
  assert.match(css, /\.drum-template-step\.hit-block::after\s*\{[^}]*top:\s*50%;[^}]*right:\s*auto;[^}]*bottom:\s*auto;[^}]*left:\s*50%;[^}]*z-index:\s*1;[^}]*width:\s*6px;[^}]*height:\s*6px;[^}]*transform:\s*translate\(-50%,\s*-50%\);/s);
  assert.match(css, /\.drum-template-step\[data-hit-label="K"\] \.drum-template-hit-label\s*\{[^}]*background:\s*var\(--c-drums\);/s);
  assert.match(css, /\.drum-template-step\[data-hit-label="S"\] \.drum-template-hit-label\s*\{[^}]*background:\s*var\(--c-chord\);/s);
  assert.match(css, /\.drum-template-step\[data-hit-label="H"\] \.drum-template-hit-label\s*\{[^}]*background:\s*var\(--hardware-amber\);/s);
  assert.match(css, /\.drum-template-actions\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /\.drum-template-apply\s*\{[^}]*min-height:\s*36px;/s);
  assert.match(css, /\.app-main:has\(\.tutorial-panel\) \.tpl-picker:not\(\[hidden\]\),\s*\n\.app-main:has\(\.tutorial-panel\) \.gtpl-picker:not\(\[hidden\]\)\s*\{[^}]*z-index:\s*var\(--tutorial-floating-ui-z\);/s);
  assert.match(css, /\.gtpl-list-centered\s*\{[^}]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(css, /\.gtpl-list-centered\s*\{[^}]*justify-content:\s*center;/s);
  assert.match(css, /\.gtpl-list-centered > \.gtpl-card\s*\{[^}]*grid-column:\s*span 2;/s);
  assert.match(css, /\.gtpl-list-centered > \.gtpl-card:first-child\s*\{[^}]*grid-column:\s*2 \/ span 2;/s);
  assert.match(css, /@media \(max-width:\s*760px\)\s*\{[\s\S]*\.gtpl-list-centered\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[\s\S]*\.gtpl-list-centered > \.gtpl-card\s*\{[^}]*grid-column:\s*auto;/s);
  assert.match(css, /\.gtpl-card\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /\.tpl-card\.tutorial-control-target\s*\{[^}]*--tutorial-highlight-accent:\s*rgb\(255 230 205 \/ 0\.82\);/s);
  assert.match(css, /\.tpl-card\.tutorial-control-target\s*\{[^}]*--tutorial-highlight-rest-shadow:[\s\S]*rgb\(255 230 205 \/ 0\.28\)/s);
  assert.match(css, /\.tpl-card\.tutorial-control-target\s*\{[^}]*--tutorial-highlight-peak-shadow:[\s\S]*rgb\(255 238 218 \/ 0\.36\)/s);
  assert.doesNotMatch(css, /\.tpl-card\.tutorial-control-target\s*\{[^}]*var\(--tutorial-target-contained-(?:rest|peak)-shadow\)/s);
  assert.match(css, /\.tpl-card\.tutorial-control-target\s*\{[^}]*color:\s*var\(--hardware-control-ink\);/s);
  assert.match(css, /\.tpl-card\.tutorial-control-target\s*\{[^}]*background:[^}]*rgb\(34 25 18 \/ 0\.96\)[^}]*var\(--hardware-control-bg\)/s);
  assert.match(css, /\.tpl-card\.tutorial-control-target\s*\{[^}]*border:\s*1px solid var\(--hardware-control-border\);/s);
  assert.doesNotMatch(css, /\.tpl-card\.tutorial-control-target\s*\{[^}]*white 78%/s);
  assert.match(css, /\.tpl-card\.tutorial-control-target \.tpl-name\s*\{[^}]*color:\s*var\(--hardware-chord-ink-strong\);/s);
  assert.match(css, /\.tpl-card\.tutorial-control-target \.tpl-desc\s*\{[^}]*color:\s*#e8c99a;/s);
  assert.match(css, /\.tpl-card\.tutorial-control-target \.tpl-foot-label\s*\{[^}]*color:\s*var\(--hardware-control-ink\);/s);
  assert.match(css, /\.gtpl-card\.tutorial-control-target\s*\{[^}]*--tutorial-highlight-rest-shadow:[\s\S]*rgb\(255 230 205 \/ 0\.28\)/s);
  assert.match(css, /\.gtpl-card\.tutorial-control-target\s*\{[^}]*--tutorial-highlight-peak-shadow:[\s\S]*rgb\(255 238 218 \/ 0\.36\)/s);
  assert.doesNotMatch(css, /\.gtpl-card\.tutorial-control-target\s*\{[^}]*var\(--tutorial-target-contained-(?:rest|peak)-shadow\)/s);
  assert.match(css, /\.gtpl-card\.tutorial-control-target\s*\{[^}]*color:\s*var\(--hardware-control-ink\);/s);
  assert.match(css, /\.gtpl-card\.tutorial-control-target\s*\{[^}]*--tutorial-highlight-accent:\s*rgb\(255 230 205 \/ 0\.82\);/s);
  assert.doesNotMatch(css, /\.gtpl-card\.tutorial-control-target\s*\{[^}]*var\(--c-drums\)/s);
  assert.match(css, /\.gtpl-card\.tutorial-control-target\s*\{[^}]*background:[^}]*rgb\(34 25 18 \/ 0\.96\)[^}]*var\(--hardware-control-bg\)/s);
  assert.match(css, /\.gtpl-card\.tutorial-control-target\s*\{[^}]*border:\s*1px solid var\(--hardware-control-border\);/s);
  assert.match(css, /\.gtpl-card\.tutorial-control-target\s*\{[^}]*outline-offset:\s*-4px;/s);
  assert.match(css, /\.gtpl-card\.tutorial-control-target\s*\{[^}]*opacity:\s*1;/s);
  assert.doesNotMatch(css, /\.gtpl-card\.tutorial-control-target\s*\{[^}]*white 78%/s);
  assert.match(css, /\.gtpl-card\.tutorial-control-target \.gtpl-name\s*\{[^}]*color:\s*var\(--hardware-chord-ink-strong\);/s);
  assert.match(css, /\.gtpl-card\.tutorial-control-target \.gtpl-desc\s*\{[^}]*color:\s*#e8c99a;/s);
  assert.match(css, /\.gtpl-card\.tutorial-control-target \.gtpl-detail\s*\{[^}]*color:\s*#f1d8ad;[^}]*background:\s*rgb\(16 9 6 \/ 0\.78\);/s);
  assert.match(css, /\.gtpl-card\.tutorial-control-target \.gtpl-foot-label\s*\{[^}]*color:\s*var\(--hardware-control-ink\);/s);
  assert.doesNotMatch(css, /\.gtpl-card\.tutorial-control-target\s*\{[^}]*grid-column:/s);
  assert.doesNotMatch(css, /\.gtpl-card\.tutorial-control-target\s*\{[^}]*width:/s);
  assert.doesNotMatch(css, /\.gtpl-card\.tutorial-control-target\s*\{[^}]*height:/s);
  assert.match(css, /\.gtpl-rhythm-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*1fr\);/s);
  assert.match(css, /\.gtpl-beat\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*1fr\);/s);
  assert.match(css, /\.gtpl-step\.hit-block::after\s*\{/s);
  assert.match(css, /\.gtpl-step\.hit-arp::after\s*\{[^}]*height:\s*calc\(28% \+ var\(--h,\s*1\) \* 18%\);/s);
  assert.match(css, /\.gtpl-picker \.tpl-pager-btn:hover:not\(:disabled\)\s*\{[^}]*background:\s*var\(--ink\);/s);
});

test('active chord template button aligns icon and label on one baseline', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.btn-template-active\s*\{[^}]*display:\s*inline-flex;/s);
  assert.match(css, /\.btn-template-active\s*\{[^}]*align-items:\s*center;/s);
  assert.match(css, /\.btn-template-active\s*\{[^}]*justify-content:\s*center;/s);
  assert.match(css, /\.btn-template-active\s*\{[^}]*line-height:\s*1;/s);
  assert.match(css, /\.btn-template-active svg\s*\{[^}]*width:\s*14px;/s);
  assert.match(css, /\.btn-template-active svg\s*\{[^}]*height:\s*14px;/s);
  assert.match(css, /\.btn-template-active svg\s*\{[^}]*flex:\s*0 0 auto;/s);
});

test('skeuomorphic shared controls use high contrast dark state layers without resizing', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.t-btn,\s*\n\.topbar \.icon-btn\s*\{[^}]*color:\s*var\(--hardware-control-ink\);/s);
  assert.match(css, /\.t-btn,\s*\n\.topbar \.icon-btn\s*\{[^}]*background:\s*var\(--hardware-control-bg\);/s);
  assert.match(css, /\.t-btn,\s*\n\.topbar \.icon-btn\s*\{[^}]*border:\s*1px solid var\(--hardware-control-border\);/s);
  assert.match(css, /\.t-btn,\s*\n\.topbar \.icon-btn\s*\{[^}]*inset 0 1px 0 rgb\(255 246 218 \/ 0\.16\)/s);
  assert.match(css, /\.t-btn:hover,\s*\n\.t-btn:focus-visible,\s*\n\.topbar \.icon-btn:hover,\s*\n\.topbar \.icon-btn:focus-visible\s*\{[^}]*color:\s*#fff1cf;/s);
  assert.match(css, /\.t-btn:hover,\s*\n\.t-btn:focus-visible,\s*\n\.topbar \.icon-btn:hover,\s*\n\.topbar \.icon-btn:focus-visible\s*\{[^}]*background:\s*rgb\(23 14 9 \/ 0\.68\);/s);
  assert.match(css, /\.t-btn\.play\s*\{[^}]*color:\s*var\(--hardware-control-ink\);/s);
  assert.match(css, /\.t-btn\.play\s*\{[^}]*var\(--hardware-control-bg\)/s);
  assert.match(css, /\.t-btn:disabled\s*\{[^}]*color:\s*var\(--hardware-control-muted\);/s);
  assert.match(css, /\.t-btn:disabled\s*\{[^}]*opacity:\s*0\.58;/s);
  assert.match(css, /\.t-btn:disabled:hover\s*\{[^}]*color:\s*var\(--hardware-control-muted\);/s);
  assert.match(css, /\.t-btn:disabled:hover\s*\{[^}]*background:\s*rgb\(18 11 7 \/ 0\.28\);/s);
  assert.match(css, /\.btn-template,\s*\n\.btn-template-groove,\s*\n\.drum-clear-action,\s*\n\.btn-template-active,\s*\n\.btn-template-groove-active,\s*\n\.btn-template-scale-active\s*\{[^}]*min-height:\s*36px;/s);
  assert.match(css, /\.btn-template,\s*\n\.btn-template-groove,\s*\n\.drum-clear-action,\s*\n\.btn-template-active,\s*\n\.btn-template-groove-active,\s*\n\.btn-template-scale-active\s*\{[^}]*color:\s*var\(--hardware-control-ink\);/s);
  assert.match(css, /\.btn-template,\s*\n\.btn-template-groove,\s*\n\.drum-clear-action,\s*\n\.btn-template-active,\s*\n\.btn-template-groove-active,\s*\n\.btn-template-scale-active\s*\{[^}]*var\(--hardware-control-bg\)/s);
});

test('editor header uses the original brass panel center band without brushed streaks', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.editor-head\s*\{[^}]*background:[^}]*var\(--asset-brass\) center 50% \/ cover no-repeat/s);
  assert.match(css, /\.editor-head\s*\{[^}]*border-bottom:\s*2px solid rgb\(48 24 10 \/ 0\.62\);/s);
  assert.match(css, /\.editor-head\s*\{[^}]*box-shadow:[^}]*inset 0 -8px 14px rgb\(47 22 9 \/ 0\.24\)/s);
  assert.match(css, /\.crumb,\s*\n\.clip-name-meta\s*\{[^}]*color:\s*#20140d;[^}]*text-shadow:\s*\n\s*0 1px 0 rgb\(255 238 196 \/ 0\.62\),\s*\n\s*0 2px 2px rgb\(0 0 0 \/ 0\.32\),\s*\n\s*0 0 1px rgb\(0 0 0 \/ 0\.74\);/s);
  assert.match(css, /\.clip-name-input\s*\{[^}]*color:\s*#160d08;[^}]*-webkit-text-stroke:\s*0\.28px rgb\(23 12 6 \/ 0\.32\);[^}]*text-shadow:\s*\n\s*0 1px 0 rgb\(255 238 198 \/ 0\.68\),\s*\n\s*0 2px 2px rgb\(0 0 0 \/ 0\.36\),\s*\n\s*0 0 1px rgb\(0 0 0 \/ 0\.8\);/s);
  assert.doesNotMatch(css, /\.editor-head\s*\{[^}]*repeating-linear-gradient/s);
  assert.doesNotMatch(css, /\.editor-head::before\s*\{/);
  assert.doesNotMatch(css, /\.editor-head::after\s*\{/);
});

test('chord template preview uses high contrast hardware controls', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.tpl-prog\s*\{[^}]*rgb\(42 24 14 \/ 0\.72\)/s);
  assert.match(css, /\.tpl-prog\s*\{[^}]*border:\s*1px solid var\(--hardware-control-border\);/s);
  assert.match(css, /\.tpl-chord,\s*\n\.cv-notes \.n\s*\{[^}]*color:\s*var\(--hardware-chord-ink-strong\);/s);
  assert.match(css, /\.tpl-chord,\s*\n\.cv-notes \.n\s*\{[^}]*rgb\(45 25 14 \/ 0\.82\)/s);
  assert.match(css, /\.tpl-chord-sep\s*\{[^}]*color:\s*var\(--hardware-control-ink\);/s);
  assert.match(css, /\.tpl-play,\s*\n\.cv-preview\s*\{[^}]*width:\s*30px;/s);
  assert.match(css, /\.tpl-play,\s*\n\.cv-preview\s*\{[^}]*height:\s*30px;/s);
  assert.match(css, /\.tpl-play,\s*\n\.cv-preview\s*\{[^}]*color:\s*var\(--hardware-control-ink\);/s);
  assert.match(css, /\.tpl-play,\s*\n\.cv-preview\s*\{[^}]*var\(--hardware-control-bg\)/s);
  assert.match(css, /\.tpl-play,\s*\n\.cv-preview\s*\{[^}]*border:\s*1px solid var\(--hardware-control-border\);/s);
  assert.doesNotMatch(css, /--variant:\s*oklch\(70% 0\.16 355\);/);
  assert.match(css, /\.chord-variants\s*\{[^}]*--variant:\s*var\(--c-chord\);/s);
  assert.match(css, /\.chord-variants\s*\{[^}]*--variant-ink:\s*var\(--c-chord-ink\);/s);
  assert.match(css, /\.chord-variants\s*\{[^}]*--variant-soft:\s*color-mix\(in oklab,\s*var\(--c-chord\) 22%,\s*var\(--surface\)\);/s);
  assert.match(css, /\.chord-variants\s*\{[^}]*--variant-deep:\s*var\(--c-chord-ink\);/s);
  assert.match(css, /\.cv-name\s*\{[^}]*color:\s*var\(--c-chord-ink\);/s);
  assert.match(css, /\.cv-name\s*\{[^}]*linear-gradient\(180deg,\s*rgb\(255 220 159 \/ 0\.82\),\s*rgb\(196 126 32 \/ 0\.78\)\)/s);
  assert.doesNotMatch(css, /\.cv-name\s*\{[^}]*background:\s*var\(--variant\);/s);
  assert.match(css, /\.cv-card\.current \.cv-name\s*\{[^}]*border-color:\s*color-mix\(in oklab,\s*var\(--hardware-amber\) 72%,\s*var\(--c-chord-ink\)\);[^}]*0 0 0 2px color-mix\(in oklab,\s*var\(--hardware-amber\) 62%,\s*var\(--c-chord-ink\)\)/s);
  assert.doesNotMatch(css, /\.cv-card\.current \.cv-name\s*\{[^}]*var\(--c-melody\)/s);
  assert.match(css, /\.cv-desc\s*\{[^}]*color:\s*rgb\(82 52 28 \/ 0\.96\);[^}]*font-weight:\s*650;[^}]*text-shadow:\s*0 1px 0 rgb\(255 255 255 \/ 0\.72\);/s);
  assert.match(css, /\.cv-card:hover,\s*\n\.cv-card\.current\s*\{[^}]*background:\s*var\(--variant-soft\);[^}]*border-color:\s*color-mix\(in oklab,\s*var\(--c-chord-ink\) 32%,\s*var\(--border\)\);/s);
  assert.match(css, /\.cv-preview\.playing,\s*\n\.cv-preview:hover\s*\{[^}]*color:\s*var\(--c-chord-ink\);[^}]*background:[^}]*var\(--c-chord\)/s);
});

test('global history buttons keep independent toolbar sizing and disabled feedback', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.history-controls\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /\.history-controls\s*\{[^}]*align-items:\s*center;/s);
  assert.match(css, /\.history-controls\s*\{[^}]*gap:\s*4px;/s);
  assert.match(css, /\.history-controls\s*\{[^}]*padding:\s*4px;/s);
  assert.match(css, /\.history-controls\s*\{[^}]*border-radius:\s*12px;/s);
  assert.match(css, /\.t-btn\.undo,\s*\.t-btn\.redo\s*\{[^}]*flex:\s*0 0 32px;/s);
  assert.match(css, /\.t-btn\.undo,\s*\.t-btn\.redo\s*\{[^}]*width:\s*32px;/s);
  assert.match(css, /\.t-btn\.undo,\s*\.t-btn\.redo\s*\{[^}]*height:\s*32px;/s);
  assert.match(css, /\.t-btn:disabled\s*\{[^}]*opacity:\s*0\.58;/s);
  assert.match(css, /\.t-btn:disabled\s*\{[^}]*cursor:\s*not-allowed;/s);
  assert.match(css, /\.t-btn:disabled:hover\s*\{[^}]*background:\s*rgb\(18 11 7 \/ 0\.28\);/s);
  assert.match(css, /\.t-btn:disabled:hover\s*\{[^}]*inset 0 1px 0 rgb\(255 246 218 \/ 0\.08\)/s);
  assert.doesNotMatch(css, /@media \(max-width:\s*980px\)[\s\S]*\.history-controls\s*\{[^}]*display:\s*none;/);
  assert.doesNotMatch(css, /@media \(max-width:\s*980px\)[\s\S]*\.t-btn\.redo\s*\{[^}]*display:\s*none;/);
});

test('tutorial sidebar is embedded as a workbench column and reopens from the topbar', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.workspace\.tutorial-sidebar-open\s*\{[^}]*grid-template-columns:\s*clamp\(188px,\s*18vw,\s*246px\) minmax\(0,\s*1fr\) clamp\(300px,\s*24vw,\s*360px\);/s);
  assert.match(css, /\.workspace\.tutorial-sidebar-collapsed\s*\{[^}]*grid-template-columns:\s*clamp\(188px,\s*18vw,\s*246px\) minmax\(0,\s*1fr\);/s);
  assert.doesNotMatch(css, /\.app\.tutorial-sidebar-open\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /\.tutorial-topbar-button\s*\{[^}]*display:\s*inline-flex;/s);
  assert.match(css, /\.tutorial-topbar-button\s*\{[^}]*align-items:\s*center;/s);
  assert.match(css, /\.tutorial-topbar-button\s*\{[^}]*justify-content:\s*center;/s);
  assert.match(css, /\.tutorial-topbar-button\s*\{[^}]*width:\s*58px;/s);
  assert.match(css, /\.tutorial-topbar-button\s*\{[^}]*height:\s*36px;/s);
  assert.match(css, /\.tutorial-topbar-button\s*\{[^}]*flex:\s*0 0 58px;/s);
  assert.match(css, /\.tutorial-topbar-button\s*\{[^}]*font-size:\s*13px;/s);
  assert.match(css, /\.tutorial-topbar-button\s*\{[^}]*font-weight:\s*800;/s);
  assert.match(css, /\.tutorial-topbar-button\s*\{[^}]*white-space:\s*nowrap;/s);
  assert.match(css, /--tutorial-floating-ui-z:\s*110;/);
  assert.match(css, /@media \(max-width:\s*1100px\)\s*\{[\s\S]*\.topbar-left-controls\s*\{[^}]*grid-row:\s*2;/);
  assert.match(css, /@media \(max-width:\s*980px\)\s*\{[\s\S]*\.right-tools\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1;/);
  assert.match(css, /\.tutorial-panel\s*\{[^}]*position:\s*relative;/s);
  assert.match(css, /\.tutorial-panel\s*\{[^}]*z-index:\s*90;/s);
  assert.match(css, /\.tutorial-panel\s*\{[^}]*grid-template-rows:\s*48px minmax\(0,\s*1fr\) var\(--tutorial-footer-height\);/s);
  assert.match(css, /\.tutorial-panel\s*\{[^}]*width:\s*100%;/s);
  assert.match(css, /\.tutorial-panel\s*\{[^}]*height:\s*100%;/s);
  assert.match(css, /\.tutorial-panel\s*\{[^}]*padding:\s*0;/s);
  assert.match(css, /\.tutorial-panel\s*\{[^}]*background:\s*color-mix\(in oklab,\s*var\(--surface\) 58%,\s*var\(--bg\)\);/s);
  assert.match(css, /\.tutorial-panel\s*\{[^}]*border-left:\s*1px solid/s);
  assert.match(css, /\.tutorial-panel\s*\{[^}]*border-radius:\s*0;/s);
  assert.match(css, /\.tutorial-panel\s*\{[^}]*font-family:\s*"Baloo 2",\s*"Nunito",\s*"Arial Rounded MT Bold",\s*"Avenir Next Rounded",\s*"Trebuchet MS",\s*"PingFang SC",\s*"Microsoft YaHei",\s*sans-serif;/s);
  assert.match(css, /\.tutorial-panel\s*\{[^}]*text-align:\s*center;/s);
  assert.match(css, /\.tutorial-panel-header\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /\.tutorial-panel-header\s*\{[^}]*align-items:\s*center;/s);
  assert.match(css, /\.tutorial-panel-header\s*\{[^}]*justify-content:\s*flex-start;/s);
  assert.match(css, /\.tutorial-panel-header\s*\{[^}]*min-height:\s*48px;/s);
  assert.match(css, /\.tutorial-panel-header\s*\{[^}]*border-bottom:\s*1px solid var\(--border-soft\);/s);
  assert.match(css, /\.tutorial-panel-header::before\s*\{[^}]*background:\s*color-mix\(in oklab,\s*var\(--hardware-amber\) 72%,\s*var\(--ink-3\)\);/s);
  assert.match(css, /\.tutorial-panel-label\s*\{[^}]*color:\s*var\(--hardware-control-ink\);/s);
  assert.doesNotMatch(css, /\.tutorial-panel-header\s*\{[^}]*grid-template-rows:/s);
  assert.doesNotMatch(css, /\.tutorial-panel-header\s*\{[^}]*justify-content:\s*space-between;/s);
  assert.doesNotMatch(css, /\.tutorial-panel-tools/);
  assert.doesNotMatch(css, /\.tutorial-icon-button/);
  assert.doesNotMatch(css, /\.tutorial-panel-title-row/);
  assert.match(css, /\.tutorial-directory\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /\.tutorial-directory\s*\{[^}]*justify-content:\s*flex-end;/s);
  assert.doesNotMatch(css, /\.tutorial-directory\s*\{[^}]*grid-template-columns:/s);
  assert.doesNotMatch(css, /\.tutorial-directory\s*\{[^}]*padding:\s*0 12px 10px;/s);
  assert.doesNotMatch(css, /\.tutorial-directory\s*\{[^}]*margin:\s*0 auto 8px;/s);
  assert.match(css, /\.tutorial-directory-button\s*\{[^}]*min-height:\s*24px;/s);
  assert.match(css, /\.tutorial-directory-button\s*\{[^}]*font-size:\s*10\.5px;/s);
  assert.match(css, /\.tutorial-directory-button\s*\{[^}]*border-radius:\s*6px;/s);
  assert.match(css, /\.tutorial-directory-button\s*\{[^}]*border:\s*1px solid color-mix\(in oklab,\s*var\(--hardware-amber\) 16%,\s*var\(--border-soft\)\);/s);
  assert.doesNotMatch(css, /\.tutorial-directory-button\s*\{[^}]*border-radius:\s*999px;/s);
  assert.match(css, /\.tutorial-directory-button\.active\s*\{[^}]*color:\s*#2a170d;[^}]*background:\s*color-mix\(in oklab,\s*var\(--hardware-amber\) 42%,\s*white\);[^}]*border-color:\s*color-mix\(in oklab,\s*var\(--hardware-amber\) 62%,\s*#4c2a12\);/s);
  assert.doesNotMatch(css, /\.tutorial-directory-button\.active\s*\{[^}]*var\(--c-drums/s);
  assert.match(css, /\.tutorial-directory-button:disabled\s*\{[^}]*opacity:\s*0\.36;/s);
  assert.match(css, /\.tutorial-panel-body\s*\{[^}]*justify-items:\s*center;/s);
  assert.match(css, /\.tutorial-panel-body\s*\{[^}]*align-content:\s*start;/s);
  assert.match(css, /\.tutorial-count-in\s*\{[^}]*pointer-events:\s*none;/s);
  assert.match(css, /\.tutorial-count-in\s*\{[^}]*justify-self:\s*center;/s);
  assert.match(css, /\.tutorial-count-in\s*\{[^}]*display:\s*grid;/s);
  assert.match(css, /\.tutorial-count-in\s*\{[^}]*place-items:\s*center;/s);
  assert.match(css, /\.tutorial-count-in\s*\{[^}]*box-shadow:[^}]*var\(--tutorial-highlight-rest-shadow\)/s);
  assert.match(css, /\.tutorial-count-in\s*\{[^}]*animation:\s*tutorial-count-in-pop/s);
  assert.match(css, /@keyframes tutorial-count-in-pop/);
  assert.match(css, /\.tutorial-copy\s*\{[^}]*display:\s*grid;/s);
  assert.match(css, /\.tutorial-copy\s*\{[^}]*align-self:\s*start;/s);
  assert.match(css, /\.tutorial-copy-title-group\s*\{[^}]*justify-self:\s*start;/s);
  assert.match(css, /\.tutorial-copy-title-group\s*\{[^}]*justify-items:\s*start;/s);
  assert.match(css, /\.tutorial-copy-body-group\s*\{[^}]*justify-self:\s*center;/s);
  assert.match(css, /\.tutorial-copy-title\s*\{[^}]*font-size:\s*13px;/s);
  assert.match(css, /\.tutorial-copy-title\s*\{[^}]*font-weight:\s*760;/s);
  assert.match(css, /\.tutorial-copy-title\s*\{[^}]*text-align:\s*left;/s);
  assert.match(css, /\.tutorial-copy-subtitle\s*\{[^}]*font-size:\s*clamp\(24px,\s*2\.6vw,\s*34px\);/s);
  assert.match(css, /\.tutorial-copy-subtitle\s*\{[^}]*font-weight:\s*950;/s);
  assert.match(css, /\.tutorial-copy-subtitle\s*\{[^}]*text-align:\s*left;/s);
  assert.match(css, /\.tutorial-copy-body\s*\{[^}]*font-size:\s*16px;/s);
  assert.match(css, /\.tutorial-copy-body\s*\{[^}]*font-weight:\s*650;/s);
  assert.match(css, /\.tutorial-copy-body\s*\{[^}]*line-height:\s*1\.62;/s);
  assert.match(css, /\.tutorial-copy-body\s*\{[^}]*text-align:\s*center;/s);
  assert.match(css, /\.tutorial-copy-title,\s*\n\.tutorial-copy-subtitle,\s*\n\.tutorial-copy-body\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
  assert.doesNotMatch(css, /\.tutorial-copy-title,\s*\n\.tutorial-copy-subtitle,\s*\n\.tutorial-copy-body\s*\{[^}]*text-align:\s*center;/s);
  assert.doesNotMatch(css, /\.tutorial-copy-action-hint/);
  assert.doesNotMatch(css, /\.tutorial-copy-line/);
  assert.doesNotMatch(css, /\.tutorial-copy-body\s*\{[^}]*font-weight:\s*800;/s);
  assert.doesNotMatch(css, /\.tutorial-panel p\s*\{/);
  assert.match(css, /\.tutorial-panel-actions\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(css, /\.tutorial-panel-actions\s*\{[^}]*align-items:\s*center;/s);
  assert.match(css, /\.tutorial-panel-actions\s*\{[^}]*gap:\s*6px;/s);
  assert.match(css, /\.tutorial-panel-actions\s*\{[^}]*height:\s*var\(--tutorial-footer-height\);/s);
  assert.match(css, /\.tutorial-panel-actions\s*\{[^}]*min-height:\s*0;/s);
  assert.match(css, /\.tutorial-panel-actions\s*\{[^}]*padding:\s*5px 12px;/s);
  assert.match(css, /\.tutorial-panel-actions\s*\{[^}]*border-top:\s*1px solid var\(--border-soft\);/s);
  assert.doesNotMatch(css, /\.timeline-footer-spacer\s*\{/);
  assert.doesNotMatch(css, /\.add-track-row\s*\{/);
  assert.match(css, /\.tutorial-primary,\s*\n\.tutorial-secondary,\s*\n\.tutorial-link\s*\{[^}]*min-height:\s*36px;/s);
  assert.match(css, /\.tutorial-primary,\s*\n\.tutorial-secondary,\s*\n\.tutorial-link\s*\{[^}]*height:\s*36px;/s);
  assert.match(css, /\.tutorial-primary,\s*\n\.tutorial-secondary,\s*\n\.tutorial-link\s*\{[^}]*border-radius:\s*999px;/s);
  assert.match(css, /\.tutorial-primary,\s*\n\.tutorial-secondary,\s*\n\.tutorial-link\s*\{[^}]*font-size:\s*13px;/s);
  assert.doesNotMatch(css, /\.tutorial-panel\s*\{[^}]*height:\s*100dvh;/s);
  assert.doesNotMatch(css, /\.tutorial-panel\s*\{[^}]*backdrop-filter:/s);
  assert.doesNotMatch(css, /\.tutorial-panel\s*\{[^}]*-14px 0 36px/s);
  assert.doesNotMatch(css, /\.tutorial-panel-actions\s*\{[^}]*min-height:\s*var\(--tutorial-footer-height\);/s);
  assert.doesNotMatch(css, /\.tutorial-panel-actions\s*\{[^}]*padding:\s*10px 12px;/s);
  assert.doesNotMatch(css, /\.tutorial-reopen-button/);
  assert.doesNotMatch(css, /\.tutorial-panel\[data-placement=/);
  assert.match(css, /--tutorial-breathe-duration:\s*1\.25s;/);
  assert.match(css, /--tutorial-breathe-ease:\s*cubic-bezier\(0\.37,\s*0,\s*0\.63,\s*1\);/);
  assert.match(css, /--tutorial-spotlight-z:\s*50;/);
  assert.match(css, /--tutorial-target-z:\s*60;/);
  assert.match(css, /--tutorial-highlight-rest-filter:\s*brightness\(1\.28\) saturate\(1\.22\);/);
  assert.match(css, /--tutorial-highlight-peak-filter:\s*brightness\(1\.62\) saturate\(1\.4\);/);
  assert.match(css, /\.tutorial-target-active\s*\{[^}]*--tutorial-highlight-accent:\s*var\(--c-drums\);/s);
  assert.match(css, /\.tutorial-target-active\s*\{[^}]*--tutorial-highlight-ink:\s*var\(--c-drums-ink\);/s);
  assert.match(css, /\.tutorial-target-active\s*\{[^}]*z-index:\s*var\(--tutorial-target-z\);/s);
  assert.match(css, /\.tutorial-target-active\s*\{[^}]*outline:\s*2px solid color-mix\(in oklab,\s*white 58%,\s*transparent\);/s);
  assert.match(css, /\.tutorial-target-active\s*\{[^}]*outline-offset:\s*3px;/s);
  assert.match(css, /\.tutorial-target-active\s*\{[^}]*box-shadow:\s*var\(--tutorial-highlight-rest-shadow\);/s);
  assert.match(css, /\.tutorial-target-active\s*\{[^}]*animation:\s*tutorial-unified-target-pulse var\(--tutorial-breathe-duration\) var\(--tutorial-breathe-ease\) infinite;/s);
  assert.match(css, /\.tutorial-target-active\s*\{[^}]*filter:\s*var\(--tutorial-highlight-rest-filter\);/s);
  assert.match(css, /--tutorial-highlight-rest-shadow:[\s\S]*0 0 0 3px color-mix\(in oklab,\s*white 68%,\s*transparent\)/s);
  assert.match(css, /--tutorial-highlight-rest-shadow:[\s\S]*var\(--tutorial-highlight-accent\) 34%,\s*transparent/s);
  assert.match(css, /--tutorial-highlight-peak-shadow:[\s\S]*0 0 0 4px color-mix\(in oklab,\s*white 82%,\s*transparent\)/s);
  assert.match(css, /--tutorial-highlight-peak-shadow:[\s\S]*var\(--tutorial-highlight-accent\) 42%,\s*transparent/s);
  assert.doesNotMatch(css, /--tutorial-highlight-peak-shadow:[\s\S]*white 90%/s);
  assert.doesNotMatch(css, /--tutorial-highlight-peak-shadow:[\s\S]*var\(--tutorial-highlight-accent\) 68%/s);
  assert.match(css, /--tutorial-target-surface:\s*color-mix\(in oklab,\s*white 84%,\s*var\(--tutorial-highlight-accent\)\);/);
  assert.match(css, /--tutorial-target-ink:\s*var\(--tutorial-highlight-ink\);/);
  assert.match(css, /--tutorial-target-surface-border:\s*color-mix\(in oklab,\s*white 58%,\s*var\(--tutorial-highlight-ink\)\);/);
  assert.match(css, /--tutorial-target-contained-rest-shadow:[\s\S]*inset 0 0 0 2px color-mix\(in oklab,\s*white 74%,\s*transparent\)/s);
  assert.match(css, /--tutorial-target-contained-peak-shadow:[\s\S]*inset 0 0 0 2px color-mix\(in oklab,\s*white 88%,\s*transparent\)/s);
  assert.match(css, /\.app-main:has\(\.tutorial-target-active\)::before,\s*\n\.app-main:has\(\.tutorial-bar-target\)::before,\s*\n\.app-main:has\(\.tutorial-control-target\)::before,\s*\n\.app-main:has\(\.tutorial-cell-target\)::before,\s*\n\.app-main:has\(\.tutorial-cell-source\)::before,\s*\n\.app-main:has\(\.tutorial-playhead-target\)::before\s*\{[^}]*position:\s*absolute;/s);
  assert.match(css, /\.app-main:has\(\.tutorial-target-active\)::before,\s*\n\.app-main:has\(\.tutorial-bar-target\)::before,\s*\n\.app-main:has\(\.tutorial-control-target\)::before,\s*\n\.app-main:has\(\.tutorial-cell-target\)::before,\s*\n\.app-main:has\(\.tutorial-cell-source\)::before,\s*\n\.app-main:has\(\.tutorial-playhead-target\)::before\s*\{[^}]*background:\s*color-mix\(in oklab,\s*black 46%,\s*transparent\);/s);
  assert.match(css, /\.app-main:has\(\.tutorial-target-active\)::before,\s*\n\.app-main:has\(\.tutorial-bar-target\)::before,\s*\n\.app-main:has\(\.tutorial-control-target\)::before,\s*\n\.app-main:has\(\.tutorial-cell-target\)::before,\s*\n\.app-main:has\(\.tutorial-cell-source\)::before,\s*\n\.app-main:has\(\.tutorial-playhead-target\)::before\s*\{[^}]*z-index:\s*var\(--tutorial-spotlight-z\);/s);
  assert.match(css, /\.timeline-col:has\(\.tutorial-bar-target\)\s*\{[^}]*z-index:\s*calc\(var\(--tutorial-target-z\) \+ 1\);/s);
  assert.match(css, /\.timeline-col:has\(\.tutorial-bar-target\) \.hover-rows\s*\{[^}]*z-index:\s*auto;/s);
  assert.match(css, /\.timeline-col:has\(\.tutorial-bar-target\) \.grid::after\s*\{[^}]*position:\s*absolute;/s);
  assert.match(css, /\.timeline-col:has\(\.tutorial-bar-target\) \.grid::after\s*\{[^}]*z-index:\s*calc\(var\(--tutorial-target-z\) - 1\);/s);
  assert.match(css, /\.timeline-col:has\(\.tutorial-bar-target\) \.grid::after\s*\{[^}]*background:\s*color-mix\(in oklab,\s*black 42%,\s*transparent\);/s);
  assert.match(css, /\.tracks-col:has\(\.tutorial-control-target\),\s*\n\.track-editor-target:has\(\.tutorial-control-target\),\s*\n\.track-editor-target:has\(\.tutorial-cell-target\),\s*\n\.track-editor-target:has\(\.tutorial-cell-source\)\s*\{[^}]*z-index:\s*calc\(var\(--tutorial-target-z\) \+ 1\);/s);
  assert.match(css, /\.tracks-col:has\(\.tutorial-control-target\)::after,\s*\n\.track-editor-target:has\(\.tutorial-control-target\)::after,\s*\n\.track-editor-target:has\(\.tutorial-cell-target\)::after,\s*\n\.track-editor-target:has\(\.tutorial-cell-source\)::after\s*\{[^}]*background:\s*color-mix\(in oklab,\s*black 42%,\s*transparent\);/s);
  assert.match(css, /\.tracks-col:has\(\.tutorial-control-target\) \.tutorial-control-target,\s*\n\.track-editor-target:has\(\.tutorial-control-target\) \.tutorial-control-target,\s*\n\.track-editor-target:has\(\.tutorial-cell-target\) \.tutorial-cell-target,\s*\n\.track-editor-target:has\(\.tutorial-cell-source\) \.tutorial-cell-source\s*\{[^}]*z-index:\s*var\(--tutorial-target-z\);/s);
  assert.doesNotMatch(css, /black 34%,\s*transparent/);
  assert.match(css, /\.topbar:has\(\.tutorial-transport-target\)\s*\{[^}]*z-index:\s*calc\(var\(--tutorial-target-z\) \+ 8\);/s);
  assert.match(css, /\.topbar:has\(\.tutorial-transport-target\)\s*\{[^}]*isolation:\s*isolate;/s);
  assert.match(css, /\.topbar:has\(\.tutorial-transport-target\)::after\s*\{[^}]*display:\s*none;/s);
  assert.match(css, /\.topbar:has\(\.tutorial-transport-target\)::after\s*\{[^}]*content:\s*none;/s);
  assert.doesNotMatch(css, /\.topbar:has\(\.tutorial-transport-target\)::after\s*\{[^}]*background:\s*color-mix\(in oklab,\s*black 46%,\s*transparent\);/s);
  assert.match(css, /\.topbar:has\(\.tutorial-transport-target\) > :not\(\.topbar-left-controls\)\s*\{[^}]*opacity:\s*0\.56;/s);
  assert.match(css, /\.topbar:has\(\.tutorial-transport-target\) > :not\(\.topbar-left-controls\)\s*\{[^}]*filter:\s*brightness\(0\.62\) saturate\(0\.78\);/s);
  assert.match(css, /\.topbar:has\(\.tutorial-transport-target\) \.topbar-left-controls\s*\{[^}]*z-index:\s*calc\(var\(--tutorial-target-z\) \+ 7\);/s);
  assert.match(css, /\.topbar:has\(\.tutorial-transport-target\) \.history-controls\s*\{[^}]*opacity:\s*0\.48;/s);
  assert.match(css, /\.tutorial-target-active::after\s*\{[^}]*content:\s*"当前步骤";/s);
  assert.match(css, /\.tutorial-target-active::after\s*\{[^}]*font-size:\s*13px;/s);
  assert.match(css, /\.tutorial-panel-header::before\s*\{[^}]*content:\s*"";/s);
  assert.match(css, /\.tutorial-panel-header::before\s*\{[^}]*width:\s*3px;/s);
  assert.match(css, /\.tutorial-panel-header::before\s*\{[^}]*height:\s*18px;/s);
  assert.match(css, /\.tutorial-panel-header::before\s*\{[^}]*box-shadow:\s*none;/s);
  assert.match(css, /\.tutorial-panel-header::before\s*\{[^}]*animation:\s*tutorial-panel-rail-breathe var\(--tutorial-breathe-duration\) var\(--tutorial-breathe-ease\) infinite;/s);
  assert.match(css, /@keyframes tutorial-panel-rail-breathe/);
  assert.doesNotMatch(css, /@keyframes tutorial-panel-step-breathe/);
  assert.match(css, /@keyframes tutorial-unified-target-pulse\s*\{[\s\S]*filter:\s*var\(--tutorial-highlight-rest-filter,\s*brightness\(1\.18\) saturate\(1\.18\)\);[\s\S]*box-shadow:\s*var\(--tutorial-highlight-rest-shadow\);[\s\S]*filter:\s*var\(--tutorial-highlight-peak-filter,\s*brightness\(1\.5\) saturate\(1\.38\)\);[\s\S]*box-shadow:\s*var\(--tutorial-highlight-peak-shadow\);/s);
  assert.doesNotMatch(css, /@keyframes tutorial-highlight-breathe/);
  assert.doesNotMatch(css, /@keyframes tutorial-clip-target-pulse/);
  assert.doesNotMatch(css, /@keyframes tutorial-target-pulse/);
});

test('tutorial task targets make allowed cells and bars obvious', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.tutorial-cell-target\s*\{[^}]*animation:\s*tutorial-unified-target-pulse var\(--tutorial-breathe-duration\) var\(--tutorial-breathe-ease\) infinite;/s);
  assert.match(css, /\.tutorial-cell-target\s*\{[^}]*filter:\s*var\(--tutorial-highlight-rest-filter\);/s);
  assert.match(css, /\.tutorial-cell-target\s*\{[^}]*position:\s*relative;/s);
  assert.match(css, /\.tutorial-cell-target\s*\{[^}]*z-index:\s*var\(--tutorial-target-z\);/s);
  assert.match(css, /\.tutorial-cell-target\s*\{[^}]*outline:\s*2px solid color-mix\(in oklab,\s*white 60%,\s*transparent\);/s);
  assert.match(css, /\.tutorial-cell-target\s*\{[^}]*outline-offset:\s*2px;/s);
  assert.match(css, /\.tutorial-cell-target\s*\{[^}]*--tutorial-cell-surface:\s*color-mix\(in oklab,\s*white 46%,\s*var\(--tutorial-cell-accent\)\);/s);
  assert.match(css, /\.tutorial-cell-target\s*\{[^}]*--tutorial-cell-border:\s*color-mix\(in oklab,\s*var\(--tutorial-cell-accent\) 82%,\s*var\(--tutorial-cell-ink\)\);/s);
  assert.match(css, /\.tutorial-cell-target\s*\{[^}]*background:\s*var\(--tutorial-cell-surface\);/s);
  assert.match(css, /\.tutorial-cell-target\s*\{[^}]*border-color:\s*var\(--tutorial-cell-border\);/s);
  assert.match(css, /\.tutorial-cell-target\s*\{[^}]*box-shadow:\s*var\(--tutorial-highlight-rest-shadow\);/s);
  assert.match(css, /\.drum-step\.active\.tutorial-cell-target\s*\{[^}]*background:\s*var\(--tutorial-cell-surface\);/s);
  assert.match(css, /\.drum-step\.active\.tutorial-cell-target\s*\{[^}]*border-color:\s*var\(--tutorial-cell-border\);/s);
  assert.doesNotMatch(css, /@keyframes tutorial-cell-pulse/);
  assert.doesNotMatch(css, /transform:\s*scale\(1\.13\);/);
  assert.match(css, /\.tutorial-cell-target-blue\s*\{[^}]*--tutorial-cell-accent:\s*oklch\(70% 0\.17 252\);/s);
  assert.match(css, /\.tutorial-cell-target-blue\s*\{[^}]*--tutorial-cell-ink:\s*oklch\(36% 0\.14 252\);/s);
  assert.match(css, /\.tutorial-cell-target-green\s*\{[^}]*--tutorial-cell-accent:\s*oklch\(72% 0\.16 150\);/s);
  assert.match(css, /\.tutorial-cell-target-green\s*\{[^}]*--tutorial-cell-ink:\s*oklch\(35% 0\.13 150\);/s);
  assert.match(css, /\.tutorial-cell-target-yellow\s*\{[^}]*--tutorial-cell-accent:\s*oklch\(84% 0\.18 88\);/s);
  assert.match(css, /\.tutorial-cell-target-yellow\s*\{[^}]*--tutorial-cell-ink:\s*oklch\(42% 0\.13 82\);/s);
  assert.doesNotMatch(css, /--tutorial-cell-accent:\s*#3b82f6;/);
  assert.doesNotMatch(css, /--tutorial-cell-accent:\s*#22c55e;/);
  assert.doesNotMatch(css, /--tutorial-cell-accent:\s*#facc15;/);
  assert.doesNotMatch(css, /\.tutorial-cell-target-blue\s*\{[^}]*animation:/s);
  assert.doesNotMatch(css, /\.tutorial-cell-target-green\s*\{[^}]*animation:/s);
  assert.doesNotMatch(css, /\.tutorial-cell-target-yellow\s*\{[^}]*animation:/s);
  assert.doesNotMatch(css, /\.tutorial-cell-existing/);
  assert.doesNotMatch(css, /\.tutorial-cell-completed/);
  assert.match(css, /\.tutorial-cell-target\s*\{[^}]*filter:\s*var\(--tutorial-highlight-rest-filter\);/s);
  assert.match(css, /\.drum-step\.active\[data-instrument="kick"\]\s*\{[^}]*background:[^}]*var\(--asset-drum-step-kick-on\)/s);
  assert.match(css, /\.drum-step\.active\[data-instrument="kick"\]\s*\{[^}]*border-color:\s*color-mix\(in oklab,\s*var\(--drum-kick\) 70%,\s*black\);/s);
  assert.match(css, /\.tutorial-cell-source\s*\{[^}]*cursor:\s*grab;/s);
  assert.match(css, /\.tutorial-cell-source\s*\{[^}]*position:\s*relative;/s);
  assert.match(css, /\.tutorial-cell-source\s*\{[^}]*z-index:\s*var\(--tutorial-target-z\);/s);
  assert.match(css, /\.tutorial-cell-source\s*\{[^}]*outline:\s*2px solid color-mix\(in oklab,\s*white 60%,\s*transparent\);/s);
  assert.match(css, /\.tutorial-cell-source\s*\{[^}]*animation:\s*tutorial-unified-target-pulse var\(--tutorial-breathe-duration\) var\(--tutorial-breathe-ease\) infinite;/s);
  assert.match(css, /\.tutorial-cell-source\s*\{[^}]*filter:\s*var\(--tutorial-highlight-rest-filter\);/s);
  assert.match(css, /\.drum-step\.tutorial-cell-source::before\s*\{[^}]*pointer-events:\s*none;[^}]*animation:\s*tutorial-kick-drag-ghost 2\.4s cubic-bezier\(0\.37,\s*0,\s*0\.24,\s*1\) infinite;/s);
  assert.match(css, /@keyframes tutorial-kick-drag-ghost\s*\{[\s\S]*transform:\s*translateX\(calc\(\(100% \+ var\(--drum-step-gap\)\) \* 2\)\) scale\(1\.08\);/s);
  assert.match(css, /\.drum-step\.tutorial-locked:not\(\.active\):not\(\.tutorial-cell-target\):not\(\.tutorial-cell-source\)\s*\{[^}]*opacity:\s*0\.18;/s);
  assert.match(css, /\.drum-step\.tutorial-locked:not\(\.active\):not\(\.tutorial-cell-target\):not\(\.tutorial-cell-source\)\s*\{[^}]*background:\s*color-mix\(in oklab,\s*var\(--surface\) 45%,\s*var\(--ink-4\)\);/s);
  assert.match(css, /\.drum-step\.tutorial-locked:not\(\.active\):not\(\.tutorial-cell-target\):not\(\.tutorial-cell-source\)\s*\{[^}]*border-color:\s*color-mix\(in oklab,\s*var\(--border\) 42%,\s*var\(--ink-4\)\);/s);
  assert.match(css, /\.drum-step\.tutorial-locked:not\(\.active\):not\(\.tutorial-cell-target\):not\(\.tutorial-cell-source\)\s*\{[^}]*filter:\s*grayscale\(1\) saturate\(0\.2\);/s);
  assert.match(css, /\.drum-step\.tutorial-locked:not\(\.active\):not\(\.tutorial-cell-target\):not\(\.tutorial-cell-source\)\s*\{[^}]*transform:\s*none;/s);
  assert.doesNotMatch(css, /\.drum-step\.tutorial-locked:not\(\.tutorial-cell-target\):not\(\.tutorial-cell-source\)\s*\{[^}]*opacity:\s*0\.18;/s);
  assert.match(css, /\.tutorial-bar-target\s*\{[^}]*animation:\s*tutorial-unified-target-pulse var\(--tutorial-breathe-duration\) var\(--tutorial-breathe-ease\) infinite;/s);
  assert.match(css, /\.tutorial-bar-target\s*\{[^}]*filter:\s*var\(--tutorial-highlight-rest-filter\);/s);
  assert.match(css, /\.tutorial-bar-target\s*\{[^}]*position:\s*relative;/s);
  assert.match(css, /\.tutorial-bar-target\s*\{[^}]*z-index:\s*var\(--tutorial-target-z\);/s);
  assert.match(css, /\.tutorial-bar-target\s*\{[^}]*outline:\s*2px solid color-mix\(in oklab,\s*white 58%,\s*transparent\);/s);
  assert.match(css, /\.tutorial-bar-target\s*\{[^}]*outline-offset:\s*3px;/s);
  assert.match(css, /\.tutorial-bar-target\s*\{[^}]*box-shadow:\s*var\(--tutorial-highlight-rest-shadow\);/s);
  assert.doesNotMatch(css, /\.tutorial-bar-target\s*\{[^}]*background:\s*color-mix\(in oklab,\s*var\(--tutorial-highlight-accent\) 14%,\s*transparent\);/s);
  assert.match(css, /\.fill-empty-clips\.tutorial-control-target,\s*\n\.clip\.tutorial-bar-target\s*\{[^}]*color:\s*var\(--tutorial-target-ink\);/s);
  assert.match(css, /\.fill-empty-clips\.tutorial-control-target,\s*\n\.clip\.tutorial-bar-target\s*\{[^}]*background:\s*var\(--tutorial-target-surface\);/s);
  assert.match(css, /\.fill-empty-clips\.tutorial-control-target,\s*\n\.clip\.tutorial-bar-target\s*\{[^}]*border:\s*1px solid var\(--tutorial-target-surface-border\);/s);
  assert.match(css, /\.clip\.tutorial-bar-target\s*\{[^}]*--clip-bg:\s*var\(--tutorial-target-surface\);/s);
  assert.match(css, /\.clip\.tutorial-bar-target\s*\{[^}]*--clip-ink:\s*var\(--tutorial-target-ink\);/s);
  assert.match(css, /\.clip\.tutorial-bar-target\s*\{[^}]*--tutorial-highlight-rest-shadow:\s*var\(--tutorial-target-contained-rest-shadow\);/s);
  assert.match(css, /\.clip\.tutorial-bar-target\s*\{[^}]*--tutorial-highlight-peak-shadow:\s*var\(--tutorial-target-contained-peak-shadow\);/s);
  assert.match(css, /\.clip\.tutorial-bar-target\s*\{[^}]*position:\s*absolute;/s);
  assert.match(css, /\.clip\.tutorial-bar-target\s*\{[^}]*outline-offset:\s*-3px;/s);
  assert.match(css, /\.clip\.tutorial-bar-target\s*\{[^}]*animation:\s*tutorial-unified-target-pulse var\(--tutorial-breathe-duration\) var\(--tutorial-breathe-ease\) infinite;/s);
  assert.match(css, /\.clip\.tutorial-bar-target\s*\{[^}]*filter:\s*var\(--tutorial-highlight-rest-filter\);/s);
  assert.doesNotMatch(css, /\.clip\.tutorial-bar-target\s*\{[^}]*top:/s);
  assert.doesNotMatch(css, /\.clip\.tutorial-bar-target\s*\{[^}]*bottom:/s);
  assert.doesNotMatch(css, /\.clip\.tutorial-bar-target\s*\{[^}]*height:/s);
  assert.match(css, /\.tutorial-bar-completed\s*\{[^}]*box-shadow:\s*var\(--tutorial-highlight-complete-shadow\);/s);
  assert.doesNotMatch(css, /@keyframes tutorial-bar-pulse/);
  assert.doesNotMatch(css, /transform:\s*scaleX\(1\.015\);/);
  assert.match(css, /\.tutorial-control-target\s*\{[^}]*animation:\s*tutorial-unified-target-pulse var\(--tutorial-breathe-duration\) var\(--tutorial-breathe-ease\) infinite;/s);
  assert.match(css, /\.tutorial-control-target\s*\{[^}]*filter:\s*var\(--tutorial-highlight-rest-filter\);/s);
  assert.match(css, /\.tutorial-control-target\s*\{[^}]*position:\s*relative;/s);
  assert.match(css, /\.tutorial-control-target\s*\{[^}]*z-index:\s*var\(--tutorial-target-z\);/s);
  assert.match(css, /\.tutorial-control-target\s*\{[^}]*outline:\s*2px solid color-mix\(in oklab,\s*white 58%,\s*transparent\);/s);
  assert.match(css, /\.tutorial-control-target\s*\{[^}]*outline-offset:\s*3px;/s);
  assert.match(css, /\.tutorial-control-target\s*\{[^}]*box-shadow:\s*var\(--tutorial-highlight-rest-shadow\);/s);
  assert.match(css, /\.tutorial-control-target:disabled,\s*\n\.fill-empty-clips\.tutorial-control-target:disabled\s*\{[^}]*opacity:\s*1;/s);
  assert.match(css, /\.tutorial-control-target:disabled,\s*\n\.fill-empty-clips\.tutorial-control-target:disabled\s*\{[^}]*filter:\s*var\(--tutorial-highlight-rest-filter\);/s);
  assert.match(css, /\.btn-template\.tutorial-control-target,\s*\n\.btn-template-groove\.tutorial-control-target,\s*\n\.fill-empty-clips\.tutorial-control-target\s*\{[^}]*--tutorial-highlight-rest-shadow:\s*var\(--tutorial-target-contained-rest-shadow\);/s);
  assert.match(css, /\.btn-template\.tutorial-control-target,\s*\n\.btn-template-groove\.tutorial-control-target,\s*\n\.fill-empty-clips\.tutorial-control-target\s*\{[^}]*background:\s*var\(--tutorial-target-surface\);/s);
  assert.match(css, /\.btn-template\.tutorial-control-target,\s*\n\.btn-template-groove\.tutorial-control-target,\s*\n\.fill-empty-clips\.tutorial-control-target\s*\{[^}]*box-shadow:\s*var\(--tutorial-highlight-rest-shadow\);/s);
  assert.match(css, /\.drum-clear-action\s*\{[\s\S]*?\.btn-template\.tutorial-control-target,\s*\n\.btn-template-groove\.tutorial-control-target,\s*\n\.drum-action\.tutorial-control-target\s*\{[^}]*background-color:\s*var\(--tutorial-target-surface\);/s);
  assert.match(css, /\.drum-clear-action\s*\{[\s\S]*?\.btn-template\.tutorial-control-target,\s*\n\.btn-template-groove\.tutorial-control-target,\s*\n\.drum-action\.tutorial-control-target\s*\{[^}]*border:\s*1px solid var\(--tutorial-target-surface-border\);/s);
  assert.match(css, /\.drum-clear-action\s*\{[\s\S]*?\.btn-template\.tutorial-control-target,\s*\n\.btn-template-groove\.tutorial-control-target,\s*\n\.drum-action\.tutorial-control-target\s*\{[^}]*box-shadow:\s*var\(--tutorial-highlight-rest-shadow\);/s);
  const finalTargetButtonBlock = css.match(/\.btn-template,\s*\n\.btn-template-groove,\s*\n\.drum-clear-action,\s*\n\.btn-template-active,\s*\n\.btn-template-groove-active,\s*\n\.btn-template-scale-active\s*\{[\s\S]*?\.btn-template\.tutorial-control-target,\s*\n\.btn-template-groove\.tutorial-control-target,\s*\n\.drum-action\.tutorial-control-target\s*\{(?<block>[\s\S]*?)\n\}/)?.groups.block;
  assert.ok(finalTargetButtonBlock, 'final tutorial target button override should exist after shared hardware button styles');
  assert.doesNotMatch(css, /#e7f7ed|#8daf9a/);
  assert.doesNotMatch(finalTargetButtonBlock, /var\(--c-drums\)|var\(--hardware-amber\)|#e7f7ed|#8daf9a/);
  assert.doesNotMatch(finalTargetButtonBlock, /var\(--tutorial-target-contained-(?:rest|peak)-shadow\)/);
  assert.match(finalTargetButtonBlock, /--tutorial-highlight-accent:\s*rgb\(255 230 205 \/ 0\.82\);/);
  assert.match(finalTargetButtonBlock, /--tutorial-highlight-rest-filter:\s*brightness\(1\.1\) saturate\(0\.94\);/);
  assert.match(finalTargetButtonBlock, /--tutorial-highlight-peak-filter:\s*brightness\(1\.18\) saturate\(0\.98\);/);
  assert.match(finalTargetButtonBlock, /--tutorial-control-highlight-glow:\s*rgb\(255 226 198 \/ 0\.24\);/);
  assert.match(finalTargetButtonBlock, /--tutorial-control-highlight-peak-glow:\s*rgb\(255 238 218 \/ 0\.34\);/);
  assert.match(finalTargetButtonBlock, /--tutorial-highlight-rest-shadow:[\s\S]*var\(--tutorial-control-highlight-glow\)/);
  assert.match(finalTargetButtonBlock, /--tutorial-highlight-peak-shadow:[\s\S]*var\(--tutorial-control-highlight-peak-glow\)/);
  assert.match(finalTargetButtonBlock, /background:[\s\S]*rgb\(255 253 240 \/ 0\.96\)[\s\S]*rgb\(250 224 192 \/ 0\.62\)[\s\S]*var\(--hardware-control-bg\)/);
  assert.doesNotMatch(finalTargetButtonBlock, /var\(--asset-brass\)/);
  assert.match(finalTargetButtonBlock, /border:\s*1px solid rgb\(255 238 214 \/ 0\.82\);/);
  assert.match(finalTargetButtonBlock, /appearance:\s*none;/);
  assert.match(finalTargetButtonBlock, /color:\s*#2a170d;/);
  assert.match(finalTargetButtonBlock, /text-shadow:\s*0 1px 0 rgb\(255 246 228 \/ 0\.58\);/);
  const finalFillTargetMatch = css.match(/\.track:has\(\.fill-empty-clips\.tutorial-control-target\)\s*\{(?<trackBlock>[\s\S]*?)\n\}\n\n\.track:has\(\.fill-empty-clips\.tutorial-control-target\) \.fill-empty-clips\.tutorial-control-target\s*\{(?<targetStackBlock>[\s\S]*?)\n\}\n\n\.track-main-row:has\(\.fill-empty-clips\.tutorial-control-target\)\s*\{(?<rowBlock>[\s\S]*?)\n\}\n\n\.fill-empty-clips\.tutorial-control-target\s*\{(?<buttonBlock>[\s\S]*?)\n\}/);
  assert.ok(finalFillTargetMatch, 'final fill-empty-clips tutorial target override should exist after hardware fill button styles');
  assert.match(finalFillTargetMatch.groups.trackBlock, /position:\s*relative;/);
  assert.match(finalFillTargetMatch.groups.trackBlock, /z-index:\s*calc\(var\(--tutorial-target-z\) \+ 1\);/);
  assert.match(finalFillTargetMatch.groups.targetStackBlock, /z-index:\s*calc\(var\(--tutorial-target-z\) \+ 2\);/);
  assert.match(finalFillTargetMatch.groups.rowBlock, /grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(72px,\s*80px\);/);
  const fillTargetSurfaceBlocks = [...css.matchAll(/\.fill-empty-clips\.tutorial-control-target\s*\{(?<block>[\s\S]*?)\n\}/g)]
    .map((match) => match.groups.block)
    .filter((block) => block.includes('--tutorial-highlight-rest-filter'));
  const finalFillTargetSurfaceBlock = fillTargetSurfaceBlocks.at(-1);
  assert.ok(finalFillTargetSurfaceBlock, 'final fill target surface override should exist after hardware target block');
  assert.match(finalFillTargetSurfaceBlock, /--tutorial-highlight-accent:\s*rgb\(255 230 205 \/ 0\.82\);/);
  assert.match(finalFillTargetSurfaceBlock, /--tutorial-highlight-ink:\s*#3f2414;/);
  assert.match(finalFillTargetSurfaceBlock, /--tutorial-target-ink:\s*#2a170d;/);
  assert.match(finalFillTargetSurfaceBlock, /--tutorial-target-surface:\s*rgb\(255 244 224 \/ 0\.9\);/);
  assert.match(finalFillTargetSurfaceBlock, /--tutorial-highlight-rest-filter:\s*brightness\(1\.1\) saturate\(0\.94\);/);
  assert.match(finalFillTargetSurfaceBlock, /--tutorial-highlight-peak-filter:\s*brightness\(1\.18\) saturate\(0\.98\);/);
  assert.match(finalFillTargetSurfaceBlock, /--tutorial-control-highlight-glow:\s*rgb\(255 226 198 \/ 0\.24\);/);
  assert.match(finalFillTargetSurfaceBlock, /--tutorial-control-highlight-peak-glow:\s*rgb\(255 238 218 \/ 0\.34\);/);
  assert.match(finalFillTargetSurfaceBlock, /--tutorial-highlight-rest-shadow:[\s\S]*var\(--tutorial-control-highlight-glow\)/);
  assert.match(finalFillTargetSurfaceBlock, /--tutorial-highlight-peak-shadow:[\s\S]*var\(--tutorial-control-highlight-peak-glow\)/);
  assert.doesNotMatch(finalFillTargetSurfaceBlock, /var\(--track-color,\s*var\(--c-drums\)\)/);
  assert.doesNotMatch(finalFillTargetSurfaceBlock, /var\(--tutorial-target-contained-(?:rest|peak)-shadow\)/);
  assert.match(finalFillTargetMatch.groups.buttonBlock, /animation:\s*tutorial-unified-target-pulse var\(--tutorial-breathe-duration\) var\(--tutorial-breathe-ease\) infinite;/);
  assert.match(finalFillTargetMatch.groups.buttonBlock, /filter:\s*var\(--tutorial-highlight-rest-filter\);/);
  assert.match(finalFillTargetMatch.groups.buttonBlock, /width:\s*76px;/);
  assert.match(finalFillTargetMatch.groups.buttonBlock, /max-width:\s*80px;/);
  assert.match(finalFillTargetMatch.groups.buttonBlock, /min-height:\s*54px;/);
  assert.match(finalFillTargetMatch.groups.buttonBlock, /overflow:\s*visible;/);
  assert.match(finalFillTargetMatch.groups.buttonBlock, /color:\s*var\(--tutorial-target-ink\);/);
  assert.match(finalFillTargetSurfaceBlock, /background:[\s\S]*rgb\(255 253 240 \/ 0\.92\)[\s\S]*var\(--hardware-control-bg\);/);
  assert.match(finalFillTargetSurfaceBlock, /border:\s*1px solid rgb\(255 238 214 \/ 0\.78\);/);
  assert.match(finalFillTargetSurfaceBlock, /box-shadow:[\s\S]*var\(--tutorial-highlight-rest-shadow\)/);
  assert.match(finalFillTargetSurfaceBlock, /filter:\s*var\(--tutorial-highlight-rest-filter\);/);
  assert.doesNotMatch(finalFillTargetMatch.groups.buttonBlock, /background:\s*transparent;/);
  assert.doesNotMatch(finalFillTargetMatch.groups.buttonBlock, /border:\s*0;/);
  const fillTargetGemBlocks = [...css.matchAll(/\.fill-empty-clips\.tutorial-control-target \.fill-gem\s*\{(?<block>[\s\S]*?)\n\}/g)]
    .map((match) => match.groups.block)
    .filter((block) => block.includes('brightness(1.24)'));
  const fillTargetGemBlock = fillTargetGemBlocks.at(-1);
  assert.ok(fillTargetGemBlock, 'tutorial fill target should brighten the gem itself');
  assert.match(fillTargetGemBlock, /width:\s*30px;/);
  assert.match(fillTargetGemBlock, /height:\s*30px;/);
  assert.doesNotMatch(fillTargetGemBlock, /var\(--c-drums\)|var\(--track-color/);
  assert.match(fillTargetGemBlock, /border-color:\s*rgb\(255 238 214 \/ 0\.72\);/);
  assert.match(fillTargetGemBlock, /filter:\s*brightness\(1\.24\) saturate\(1\.08\);/);
  assert.match(fillTargetGemBlock, /box-shadow:[\s\S]*0 0 16px rgb\(255 226 198 \/ 0\.28\)/);
  const fillTargetLabelBlock = css.match(/\.fill-empty-clips\.tutorial-control-target \.fill-empty-clips-label\s*\{(?<block>[\s\S]*?)\n\}/)?.groups.block;
  assert.ok(fillTargetLabelBlock, 'tutorial fill target should make the label readable');
  assert.match(fillTargetLabelBlock, /display:\s*block;/);
  assert.match(fillTargetLabelBlock, /max-width:\s*72px;/);
  assert.match(fillTargetLabelBlock, /overflow:\s*visible;/);
  assert.match(fillTargetLabelBlock, /text-overflow:\s*clip;/);
  assert.match(fillTargetLabelBlock, /color:\s*var\(--tutorial-target-ink\);/);
  assert.match(fillTargetLabelBlock, /font-size:\s*10\.5px;/);
  assert.match(fillTargetLabelBlock, /font-weight:\s*900;/);
  assert.match(fillTargetLabelBlock, /text-shadow:\s*0 1px 0 rgb\(255 246 218 \/ 0\.78\),\s*0 0 8px rgb\(255 246 218 \/ 0\.5\);/);
  const compactFillTargetMatch = css.match(/@media\s*\(max-height:\s*720px\)\s*\{[\s\S]*?\.track-main-row:has\(\.fill-empty-clips\.tutorial-control-target\)\s*\{(?<rowBlock>[\s\S]*?)\n\s*\}[\s\S]*?\.fill-empty-clips\.tutorial-control-target\s*\{(?<buttonBlock>[\s\S]*?)\n\s*\}[\s\S]*?\.fill-empty-clips\.tutorial-control-target \.fill-gem\s*\{(?<gemBlock>[\s\S]*?)\n\s*\}[\s\S]*?\.fill-empty-clips\.tutorial-control-target \.fill-empty-clips-label\s*\{(?<labelBlock>[\s\S]*?)\n\s*\}/);
  assert.ok(compactFillTargetMatch, 'compact height layout should keep tutorial fill target readable');
  assert.match(compactFillTargetMatch.groups.rowBlock, /grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(68px,\s*72px\);/);
  assert.match(compactFillTargetMatch.groups.buttonBlock, /width:\s*70px;/);
  assert.match(compactFillTargetMatch.groups.buttonBlock, /max-width:\s*72px;/);
  assert.match(compactFillTargetMatch.groups.buttonBlock, /height:\s*48px;/);
  assert.match(compactFillTargetMatch.groups.buttonBlock, /overflow:\s*visible;/);
  assert.doesNotMatch(compactFillTargetMatch.groups.buttonBlock, /width:\s*46px;/);
  assert.doesNotMatch(compactFillTargetMatch.groups.buttonBlock, /height:\s*34px;/);
  assert.match(compactFillTargetMatch.groups.gemBlock, /width:\s*24px;/);
  assert.match(compactFillTargetMatch.groups.gemBlock, /height:\s*24px;/);
  assert.match(compactFillTargetMatch.groups.labelBlock, /max-width:\s*66px;/);
  assert.match(compactFillTargetMatch.groups.labelBlock, /font-size:\s*9\.5px;/);
  assert.match(compactFillTargetMatch.groups.labelBlock, /overflow:\s*visible;/);
  assert.match(css, /\.btn-template-groove\.tutorial-control-target svg\s*\{[^}]*color:\s*#2a170d;[^}]*filter:\s*drop-shadow\(0 1px 0 rgb\(255 246 228 \/ 0\.58\)\);/s);
  assert.doesNotMatch(css, /\.tutorial-control-target\s*\{[^}]*transform:/s);
  assert.doesNotMatch(css, /@keyframes tutorial-control-pulse/);
  assert.match(css, /\.transport\.tutorial-transport-target\s*\{[^}]*--tutorial-highlight-accent:\s*var\(--c-drums\);/s);
  assert.match(css, /\.transport\.tutorial-transport-target\s*\{[^}]*--tutorial-highlight-ink:\s*var\(--c-drums-ink\);/s);
  assert.match(css, /\.transport\.tutorial-transport-target\s*\{[^}]*--tutorial-highlight-rest-shadow:\s*none;/s);
  assert.match(css, /\.transport\.tutorial-transport-target\s*\{[^}]*--tutorial-highlight-peak-shadow:\s*none;/s);
  assert.match(css, /\.transport\.tutorial-transport-target\s*\{[^}]*color:\s*var\(--tutorial-target-ink\);/s);
  assert.match(css, /\.transport\.tutorial-transport-target\s*\{[^}]*background:\s*transparent;/s);
  assert.match(css, /\.transport\.tutorial-transport-target\s*\{[^}]*border-color:\s*transparent;/s);
  assert.match(css, /\.transport\.tutorial-transport-target\s*\{[^}]*z-index:\s*calc\(var\(--tutorial-target-z\) \+ 9\);/s);
  assert.match(css, /\.transport\.tutorial-transport-target\s*\{[^}]*isolation:\s*isolate;/s);
  assert.match(css, /\.transport\.tutorial-transport-target\s*\{[^}]*outline:\s*0;/s);
  assert.match(css, /\.transport\.tutorial-transport-target\s*\{[^}]*box-shadow:\s*none;/s);
  assert.match(css, /\.transport\.tutorial-transport-target\s*\{[^}]*filter:\s*none;/s);
  assert.match(css, /\.transport\.tutorial-transport-target\s*\{[^}]*animation:\s*none;/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\s*\{[^}]*background:\s*transparent;/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\s*\{[^}]*box-shadow:\s*none;/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\s*\{[^}]*filter:\s*brightness\(0\.7\) saturate\(0\.8\);/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\.play\s*\{[^}]*color:\s*var\(--tutorial-target-ink\);/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\.play\s*\{[^}]*--tutorial-highlight-rest-filter:\s*brightness\(1\.32\) saturate\(1\.22\);/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\.play\s*\{[^}]*--tutorial-highlight-peak-filter:\s*brightness\(1\.68\) saturate\(1\.42\);/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\.play\s*\{[^}]*--tutorial-highlight-rest-shadow:[^}]*0 0 0 2px color-mix\(in oklab,\s*white 74%,\s*transparent\)[^}]*0 0 0 6px color-mix\(in oklab,\s*var\(--c-drums\) 26%,\s*transparent\)[^}]*0 0 20px color-mix\(in oklab,\s*white 22%,\s*transparent\)[^}]*0 10px 20px color-mix\(in oklab,\s*black 22%,\s*transparent\);/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\.play\s*\{[^}]*--tutorial-highlight-peak-shadow:[^}]*0 0 0 3px color-mix\(in oklab,\s*white 82%,\s*transparent\)[^}]*0 0 0 8px color-mix\(in oklab,\s*var\(--c-drums\) 34%,\s*transparent\)[^}]*0 0 28px color-mix\(in oklab,\s*white 26%,\s*transparent\);/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\.play\s*\{[^}]*position:\s*relative;/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\.play\s*\{[^}]*z-index:\s*calc\(var\(--tutorial-target-z\) \+ 10\);/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\.play\s*\{[^}]*background:\s*color-mix\(in oklab,\s*white 82%,\s*var\(--c-drums\)\);/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\.play\s*\{[^}]*border:\s*1px solid color-mix\(in oklab,\s*var\(--c-drums-ink\) 36%,\s*white\);/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\.play\s*\{[^}]*outline:\s*2px solid color-mix\(in oklab,\s*white 82%,\s*transparent\);/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\.play\s*\{[^}]*outline-offset:\s*-2px;/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\.play\s*\{[^}]*box-shadow:\s*var\(--tutorial-highlight-rest-shadow\);/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\.play\s*\{[^}]*filter:\s*var\(--tutorial-highlight-rest-filter\);/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\.play\s*\{[^}]*animation:\s*tutorial-unified-target-pulse var\(--tutorial-breathe-duration\) var\(--tutorial-breathe-ease\) infinite;/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\.play\s*\{[^}]*opacity:\s*1;/s);
  assert.doesNotMatch(css, /\.transport\.tutorial-transport-target \.t-btn\.play\s*\{[^}]*background:\s*transparent;/s);
  assert.doesNotMatch(css, /\.transport\.tutorial-transport-target \.t-btn\.play\s*\{[^}]*background:\s*var\(--play\);/s);
  assert.doesNotMatch(css, /\.transport\.tutorial-transport-target \.t-btn\.play\s*\{[^}]*box-shadow:\s*var\(--tutorial-target-contained-rest-shadow\);/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\.play\.active\s*\{[^}]*background:\s*color-mix\(in oklab,\s*white 82%,\s*var\(--c-drums\)\);/s);
  assert.match(css, /\.transport\.tutorial-transport-target \.t-btn\.play\.active\s*\{[^}]*box-shadow:\s*var\(--tutorial-highlight-rest-shadow\);/s);
  assert.doesNotMatch(css, /\.t-btn\.play\.tutorial-control-target/);
  assert.match(css, /\.playhead\.tutorial-playhead-target\s*\{[^}]*animation:\s*tutorial-unified-target-pulse var\(--tutorial-breathe-duration\) var\(--tutorial-breathe-ease\) infinite;/s);
  assert.match(css, /\.playhead\.tutorial-playhead-target\s*\{[^}]*filter:\s*var\(--tutorial-highlight-rest-filter\);/s);
  assert.match(css, /\.playhead\.tutorial-playhead-target\s*\{[^}]*z-index:\s*var\(--tutorial-target-z\);/s);
  assert.match(css, /\.ruler-playhead\.tutorial-playhead-target\s*\{[^}]*z-index:\s*var\(--tutorial-target-z\);/s);
  assert.match(css, /\.ruler-playhead\.tutorial-playhead-target\s*\{[^}]*background:\s*transparent;/s);
  assert.match(css, /\.ruler-playhead\.tutorial-playhead-target\s*\{[^}]*animation:\s*none;/s);
  assert.match(css, /\.ruler-playhead\.tutorial-playhead-target::before,\s*\n\.ruler-playhead\.tutorial-playhead-completed::before\s*\{[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s);
  assert.match(css, /\.playhead\.tutorial-playhead-target\s*\{[^}]*background:\s*color-mix\(in oklab,\s*var\(--c-drums-ink\) 86%,\s*white\);/s);
  assert.match(css, /\.playhead\.tutorial-playhead-target\s*\{[^}]*box-shadow:\s*var\(--tutorial-highlight-rest-shadow\);/s);
  assert.match(css, /\.ruler-playhead::after\s*\{[^}]*position:\s*absolute;[^}]*z-index:\s*13;[^}]*left:\s*50%;[^}]*width:\s*16px;[^}]*height:\s*16px;[^}]*border-radius:\s*50%;[^}]*transform:\s*translateX\(-50%\);[^}]*pointer-events:\s*none;/s);
  assert.match(css, /\.ruler-playhead::after\s*\{[^}]*background:\s*color-mix\(in oklab,\s*var\(--brand\) 72%,\s*black\);/s);
  assert.match(css, /\.ruler-playhead::after\s*\{[^}]*border:\s*2px solid color-mix\(in oklab,\s*white 86%,\s*transparent\);/s);
  assert.match(css, /\.ruler-playhead::after\s*\{[^}]*box-shadow:[^}]*0 0 10px/s);
  assert.match(css, /\.ruler-playhead\.tutorial-playhead-target::after\s*\{[^}]*background:\s*color-mix\(in oklab,\s*var\(--c-drums-ink\) 88%,\s*black\);/s);
  assert.match(css, /\.ruler-playhead\.tutorial-playhead-target::after\s*\{[^}]*border:\s*2px solid color-mix\(in oklab,\s*white 66%,\s*transparent\);/s);
  assert.match(css, /\.ruler-playhead\.tutorial-playhead-target::after\s*\{[^}]*outline:\s*2px solid color-mix\(in oklab,\s*white 60%,\s*transparent\);/s);
  assert.match(css, /\.ruler-playhead\.tutorial-playhead-target::after\s*\{[^}]*outline-offset:\s*2px;/s);
  assert.match(css, /\.ruler-playhead\.tutorial-playhead-target::after\s*\{[^}]*box-shadow:\s*var\(--tutorial-highlight-rest-shadow\);/s);
  assert.match(css, /\.ruler-playhead\.tutorial-playhead-target::after\s*\{[^}]*animation:\s*tutorial-unified-target-pulse var\(--tutorial-breathe-duration\) var\(--tutorial-breathe-ease\) infinite;/s);
  assert.match(css, /\.ruler-playhead\.tutorial-playhead-target::after\s*\{[^}]*filter:\s*var\(--tutorial-highlight-rest-filter\);/s);
  assert.doesNotMatch(css, /\.playhead-hit\.tutorial-playhead-target/);
  assert.doesNotMatch(css, /\.playhead\.tutorial-playhead-target::after/);
  assert.doesNotMatch(css, /@keyframes tutorial-playhead-pulse/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*\.tutorial-target-active,[\s\S]*\.tutorial-cell-target,[\s\S]*\.tutorial-cell-source,[\s\S]*\.tutorial-bar-target,[\s\S]*\.tutorial-control-target,[\s\S]*\.playhead\.tutorial-playhead-target,[\s\S]*\.ruler-playhead\.tutorial-playhead-target::after[\s\S]*animation:\s*none;/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*filter:\s*var\(--tutorial-highlight-peak-filter\);[\s\S]*box-shadow:\s*var\(--tutorial-highlight-peak-shadow\);/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*\.transport\.tutorial-transport-target \.t-btn\.play\s*\{[^}]*animation:\s*none;[^}]*filter:\s*var\(--tutorial-highlight-peak-filter\);[^}]*box-shadow:\s*var\(--tutorial-highlight-peak-shadow\);/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*\.drum-step\.tutorial-cell-source::before\s*\{[^}]*animation:\s*none;/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*\.tutorial-panel-header::before[\s\S]*animation:\s*none;/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*\.tutorial-count-in\s*\{[^}]*animation:\s*none;/s);
});

test('clip name edit icon sits beside the shared clip name input', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.clip-name-field\s*\{[^}]*display:\s*inline-flex;/s);
  assert.match(css, /\.clip-name-field\s*\{[^}]*align-items:\s*center;/s);
  assert.match(css, /\.clip-name-edit-icon\s*\{[^}]*flex:\s*0 0 auto;/s);
  assert.match(css, /\.clip-name-edit-icon\s*\{[^}]*pointer-events:\s*none;/s);
});

test('add chord panels keep enrich and passing picker layout without diatonic UI', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.chord-variants\s*\{[^}]*position:\s*fixed;/s);
  assert.match(css, /\.chord-variants\s*\{[^}]*z-index:\s*50;/s);
  assert.match(css, /\.chord-variants\s*\{[^}]*width:\s*min\(760px,\s*calc\(100vw - 32px\)\);/s);
  assert.match(css, /\.app-main:has\(\.tutorial-panel\) \.chord-variants\s*\{[^}]*z-index:\s*var\(--tutorial-floating-ui-z\);/s);
  assert.doesNotMatch(css, /\.app-main:has\(\.tutorial-panel\) \.chord-variants\s*\{[^}]*width:/s);
  assert.match(css, /\.cv-title\s*\{[^}]*font-size:\s*15\.5px;[^}]*font-weight:\s*800;/s);
  assert.doesNotMatch(css, /\.cv-tabs\s*\{/);
  assert.doesNotMatch(css, /\.cv-tab/);
  assert.match(css, /\.cv-panel\[hidden\]\s*\{[^}]*display:\s*none !important;/s);
  assert.doesNotMatch(css, /\.cv-grid\.diatonic/);
  assert.match(css, /\.cv-grid\.enrich\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(css, /\.cv-context\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /\.cv-context\.enrich\s*\{[^}]*gap:\s*8px;/s);
  assert.match(css, /\.cv-context\.enrich \.cv-ctx-chord\s*\{[^}]*flex:\s*0 1 auto;[^}]*min-width:\s*0;/s);
  assert.match(css, /\.current-chord-preview\s*\{[^}]*flex:\s*0 0 auto;/s);
  assert.match(css, /\.cv-empty\s*\{[^}]*border:\s*1px dashed var\(--border\);/s);
  assert.match(css, /\.cv-preview\s*\{[^}]*width:\s*28px;[^}]*height:\s*28px;/s);
  assert.match(css, /\.cv-grid\.passing\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(css, /\.passing-variants \.cv-card\s*\{[^}]*height:\s*100%;/s);
  assert.doesNotMatch(css, /\.passing-variants \.cv-card\s*\{[^}]*min-height:\s*168px;/s);
  assert.doesNotMatch(css, /\.passing-variants \.cv-card\s*\{[^}]*padding:\s*18px;/s);
  assert.match(css, /\.passing-variants \.cv-foot\s*\{[^}]*flex-direction:\s*row;[^}]*align-items:\s*center;/s);
  assert.match(css, /\.passing-variants \.cv-foot\s*\{[^}]*margin-top:\s*auto;/s);
  assert.doesNotMatch(css, /\.passing-variants \.cv-foot\s*\{[^}]*flex-direction:\s*column;/s);
  assert.match(css, /\.passing-variants \.cv-preview\.full-context\s*\{[^}]*display:\s*inline-flex;/s);
  assert.match(css, /\.passing-variants \.cv-preview\.full-context\s*\{[^}]*width:\s*auto;/s);
  assert.match(css, /\.passing-variants \.cv-preview\.full-context\s*\{[^}]*height:\s*28px;/s);
  assert.match(css, /\.passing-variants \.cv-preview\.full-context\s*\{[^}]*border-radius:\s*999px;/s);
  assert.doesNotMatch(css, /\.cv-roman\s*\{/);
});

test('passing chord shortcut anchors over column fifteen without shifting the grid', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.beat-group\.has-passing \.beat-head\s*\{[^}]*position:\s*relative;/s);
  assert.match(css, /\.beat-group\.has-passing \.beat-head \.add-chord-btn\s*\{[^}]*width:\s*auto;/s);
  assert.match(css, /\.passing-anchor\s*\{[^}]*position:\s*absolute;[^}]*top:\s*50%;[^}]*left:\s*62\.5%;/s);
  assert.match(css, /\.passing-anchor\.tutorial-passing-anchor-target\s*\{[^}]*z-index:\s*var\(--tutorial-target-z\);/s);
  assert.match(css, /\.passing-btn\.tutorial-control-target\s*\{[^}]*color:\s*var\(--tutorial-target-ink\);[^}]*background:\s*color-mix\(in oklab, white 82%, var\(--tutorial-target-surface\)\);[^}]*border:\s*1px solid var\(--tutorial-target-surface-border\);/s);
  assert.match(css, /\.passing-btn\.tutorial-control-target\s*\{[^}]*box-shadow:\s*var\(--tutorial-target-contained-rest-shadow\),/s);
  const addChordTargetBlock = css.match(/\.add-chord-btn\.tutorial-control-target\s*\{(?<block>[\s\S]*?)\n\}/)?.groups.block;
  assert.ok(addChordTargetBlock, 'tutorial add-chord button should have its own warm highlight block');
  assert.match(addChordTargetBlock, /--tutorial-highlight-accent:\s*rgb\(255 230 205 \/ 0\.82\);/);
  assert.match(addChordTargetBlock, /--tutorial-control-highlight-glow:\s*rgb\(255 226 198 \/ 0\.24\);/);
  assert.match(addChordTargetBlock, /--tutorial-highlight-rest-shadow:[\s\S]*var\(--tutorial-control-highlight-glow\)/);
  assert.match(addChordTargetBlock, /border:\s*1px solid rgb\(255 238 214 \/ 0\.78\);/);
  assert.doesNotMatch(addChordTargetBlock, /var\(--c-chord|var\(--track-color|var\(--c-drums\)/);
  assert.match(css, /\.add-chord-btn\s*\{[^}]*background:\s*var\(--bg-deep\);[^}]*border:\s*1px solid var\(--border-soft\);[^}]*border-radius:\s*999px;/s);
  assert.match(css, /\.chord-label-segment\s*\{/);
  assert.match(css, /\.add-chord-btn\.variants-open,\s*\.passing-btn\.variants-open\s*\{/);
  assert.match(css, /\.add-chord-btn\.variants-open,\s*\.passing-btn\.variants-open\s*\{[^}]*border-color:\s*color-mix\(in oklab,\s*var\(--hardware-amber\) 72%,\s*var\(--c-chord-ink\)\);[^}]*0 0 0 2px color-mix\(in oklab,\s*var\(--hardware-amber\) 68%,\s*var\(--c-chord-ink\)\)/s);
  assert.doesNotMatch(css, /\.add-chord-btn\.variants-open,\s*\.passing-btn\.variants-open\s*\{[^}]*oklch\(70% 0\.16 355\)/s);
  assert.doesNotMatch(css, /\.add-chord-btn\.variants-open,\s*\.passing-btn\.variants-open\s*\{[^}]*oklch\(56% 0\.16 355 \/ 0\.22\)/s);
  assert.doesNotMatch(css, /\.passing-anchor\s*\{[^}]*top:\s*calc\(-1 \*/s);
  assert.doesNotMatch(css, /\.passing-anchor::after\s*\{/);
  assert.doesNotMatch(css, /\.beat-group\.has-passing \.beat-cells::before\s*\{/);
  assert.doesNotMatch(css, /oklch\(70% 0\.16 355 \/ 0\.06\)/);
  assert.doesNotMatch(css, /\.passing-btn\s*\{[^}]*background:\s*var\(--ink\);/s);
  assert.doesNotMatch(css, /\.passing-btn\s*\{[^}]*color:\s*white;/s);
  assert.doesNotMatch(css, /\.passing-btn\s*\{[^}]*border:\s*0;/s);
  assert.doesNotMatch(css, /\.passing-btn\s*\{[^}]*box-shadow:/s);
  assert.doesNotMatch(css, /\.passing-btn svg\s*\{/);
  assert.doesNotMatch(css, /\.passing-anchor\s*\{[^}]*margin/s);
  assert.doesNotMatch(css, /\.passing-btn\s*\{[^}]*margin/s);
});

test('clip copy paste controls and overwrite dialog fit the hardware topbar', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.clip-controls\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /\.clip-controls\s*\{[^}]*align-items:\s*center;/s);
  assert.match(css, /\.clip-controls\s*\{[^}]*gap:\s*4px;/s);
  assert.match(css, /\.clip-controls\s*\{[^}]*padding:\s*4px;/s);
  assert.match(css, /\.clip-controls\s*\{[^}]*background:\s*var\(--bg-deep\);/s);
  assert.match(css, /\.clip-controls\s*\{[^}]*border:\s*1px solid var\(--border-soft\);/s);
  assert.match(css, /\.clip-controls\s*\{[^}]*border-radius:\s*12px;/s);
  assert.match(css, /\.clip-controls \.t-btn:disabled\s*\{[^}]*opacity:\s*0\.42;/s);
  assert.match(css, /\.clip-paste-confirm-overlay\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*z-index:\s*70;/s);
  assert.match(css, /\.clip-paste-confirm-dialog\s*\{[^}]*var\(--asset-brass\) center \/ cover/s);
  assert.match(css, /\.clip-paste-confirm-dialog\s*\{[^}]*border:\s*1px solid rgb\(255 220 156 \/ 0\.42\);/s);
  assert.match(css, /\.clip-paste-confirm-actions\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*flex-end;/s);
  assert.match(css, /\.clip-paste-confirm-cancel,\s*\n\.clip-paste-confirm-apply\s*\{[^}]*min-height:\s*38px;/s);
  assert.match(css, /@media\s*\(max-width:\s*980px\)\s*\{[\s\S]*\.topbar-left-controls\s*\{[^}]*overflow-x:\s*auto;/s);
  assert.doesNotMatch(css, /window\.confirm/);
});
