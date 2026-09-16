import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  isSecondaryMenuInteractionInside,
} from '../src/app/useSecondaryMenuDismiss.js';

test('secondary menu hit testing only treats contained targets as internal interactions', () => {
  const insideTarget = {};
  const outsideTarget = {};
  const menuElement = {
    contains: (target) => target === insideTarget,
  };

  assert.equal(
    isSecondaryMenuInteractionInside(insideTarget, [null, menuElement]),
    true,
  );
  assert.equal(
    isSecondaryMenuInteractionInside(outsideTarget, [null, menuElement]),
    false,
  );
  assert.equal(isSecondaryMenuInteractionInside(null, [menuElement]), false);
});

test('secondary menus share outside-click dismissal without dismissing confirmations', async () => {
  const [
    hookSource,
    tracksSource,
    drumsSource,
    chordSource,
    bassSource,
    melodySource,
  ] = await Promise.all([
    readFile(new URL('../src/app/useSecondaryMenuDismiss.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/components/TracksColumn.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/components/DrumSequencer.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/components/ChordEditor.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/components/BassEditor.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/components/MelodyEditor.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(hookSource, /document\.addEventListener\('mousedown', handleMouseDown\)/);
  assert.match(hookSource, /document\.addEventListener\('keydown', handleKeyDown\)/);
  assert.match(hookSource, /menuRef\?\.current/);
  assert.match(hookSource, /triggerRef\?\.current/);
  assert.match(hookSource, /isIgnoredTarget\?\.\(event\.target\)/);

  assert.match(tracksSource, /const \[trackManagerOpen, setTrackManagerOpen\] = useState\(false\)/);
  assert.match(tracksSource, /if \(!trackManagerOpen && !pendingRemoveTrackId\) return undefined/);
  assert.match(tracksSource, /if \(pendingRemoveTrackId\) setPendingRemoveTrackId\(null\)/);
  assert.match(tracksSource, /else setTrackManagerOpen\(false\)/);
  assert.match(tracksSource, /className="track-manager-overlay"/);
  assert.match(tracksSource, /role="dialog"/);
  assert.match(tracksSource, /className="track-delete-confirm-overlay"/);
  assert.doesNotMatch(tracksSource, /track-manager-overlay"[^>]*onClick=/);

  assert.match(drumsSource, /active: drumTemplatePickerOpen/);
  assert.match(drumsSource, /if \(drumTemplatePickerOpen\) \{[\s\S]*closeTemplatePicker\(\);[\s\S]*setDrumTemplatePickerOpen\(true\);/);
  assert.match(drumsSource, /onDismiss:\s*closeTemplatePicker/);
  assert.match(drumsSource, /ref=\{templatePickerRef\}/);
  assert.match(drumsSource, /ref=\{templateTriggerRef\}/);

  assert.match(chordSource, /active: workspaceOpen && !confirmApplyOpen/);
  assert.match(chordSource, /active: Boolean\(harmonyPanel\)/);
  assert.match(chordSource, /isIgnoredTarget: isHarmonyTrigger/);
  assert.match(chordSource, /onClick=\{workspaceOpen \? closeWorkspace : openWorkspace\}/);
  assert.doesNotMatch(chordSource, /className="tpl-confirm-overlay"[^>]*onClick=/);

  assert.match(bassSource, /active: groovePickerOpen && !confirmApplyOpen/);
  assert.match(bassSource, /mode === 'groove' \? null : 'groove'/);
  assert.doesNotMatch(bassSource, /className="tpl-confirm-overlay"[^>]*onClick=/);

  assert.match(melodySource, /active: pickerMode !== null/);
  assert.match(melodySource, /mode === 'style' \? null : 'style'/);
  assert.match(melodySource, /ref=\{stylePickerRef\}/);
  assert.match(melodySource, /ref=\{styleTriggerRef\}/);
  assert.doesNotMatch(melodySource, /className="melody-record-confirm-overlay"[^>]*onClick=/);
});
