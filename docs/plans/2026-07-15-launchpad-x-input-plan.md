# Launchpad X Drums and Chord 16-Step Implementation Plan

## Goal

Turn Launchpad X Programmer Mode into a context-aware no-page 16-step Drums and Chord rhythm editor with global transport controls, static LED synchronization, and input-only degradation when no MIDI output is available.

## Tasks

### Task 1: Lock the surface contract

- [x] Verify the official Programmer Mode note and CC layout.
- [x] Record the six-row Drums mapping, three preview pads, Capture MIDI CC 98, and Stop Clip CC 49.
- [x] Keep Stop Clip hardware-specific: stop playback and return transport to bar 1, step 1 without changing keyboard or pointer stop behavior.
- [x] Record palette values and the no-SysEx static LED protocol.
- [x] Define the shared context boundary for a later Melody layout.

### Task 2: Extend AppCommands

- [x] Add failing guard tests for `drums.preview` and invalid preview payloads.
- [x] Add failing dispatcher tests proving previews trigger audio without matrix handlers.
- [x] Add `drums.preview` to the command registry, guard, and dispatcher.
- [x] Run the focused command tests.

### Task 3: Map the Drums surface

- [x] Add failing tests for every six-row boundary and steps 1–16.
- [x] Add failing tests for preview pads, unused pads, inactive Drums context, releases, aftertouch, and global CC controls.
- [x] Implement one pure surface definition and a context-aware message mapper.
- [x] Run `node --test tests/launchpad_x_input.test.js`.

### Task 4: Build deterministic LED frames

- [x] Add failing tests for dim empty steps, bright hits, preview keys, transport buttons, inactive clearing, and unused regions.
- [x] Implement a complete 64-note plus four-CC frame builder using channel-1 Note/CC messages.
- [x] Run the focused Launchpad tests.

### Task 5: Add MIDI output and hot-plug recovery

- [x] Add failing tests for macOS/Windows-style LPX MIDI output names, DAW exclusion, and disconnected ports.
- [x] Extend the Web MIDI hook to bind input and output independently.
- [x] Keep input connected when output is absent or fails, expose LED availability, and retry on state changes.
- [x] Redraw after matrix, selected bar, Drums context, playback, and output changes.

### Task 6: Integrate with the app

- [x] Route hardware `drums.toggle` through `handleDrumsStepToggle`.
- [x] Supply the latest `drumsActive`, `drumsClipBars`, `selectedBar`, `matrix`, and `isPlaying` context to the hook.
- [x] Update the connection control for input-only status and replace the old bottom-left play hint.
- [x] Add source/UI regression coverage.

### Task 7: Verify

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [ ] Physically verify bar switching, auto-create, rapid select-then-step editing, three Drums previews, Chord rhythm editing, play/pause, stop-and-rewind, editor exit clearing, and unplug/replug recovery.

### Task 8: Add hardware clip selection

- [x] Move Kick, Snare, and Hi-Hat previews to Note 21–23 and map Note 11–18 to bars 1–8.
- [x] Map CC 93/94 to previous/next existing Drums clips with sparse-list wrapping.
- [x] Add validated `drums.selectClip` commands and select-or-create behavior with tutorial and undo support.
- [x] Seek every Launchpad-selected bar to step zero while playing or stopped.
- [x] Keep rapid select-then-step messages synchronized with live store state.
- [x] Add clip and navigation LED states and focused regression coverage.

### Task 9: Define the Chord interaction boundary

- [x] Keep template selection, preview, enrichment choice, passing-chord choice, and Chord audition in the pointer UI.
- [x] Reserve rows one and two for 16 Chord rhythm steps and leave rows three through seven unused.
- [x] Reuse the bottom row and CC 93/94 for Chord bar selection and existing-clip navigation.
- [x] Reserve amber variants for Chord and blue/purple for later Bass and Melody layouts.

### Task 10: Implement the Chord surface

- [x] Add validated `chord.selectClip` and `chord.toggleRhythm` AppCommands.
- [x] Add a shared track-aware clip selection helper with direct-create, tutorial guard, undo, and bar-start seek behavior.
- [x] Map Chord steps 1–16, direct bars 1–8, and sparse wraparound clip navigation.
- [x] Add complete Chord LED frames for empty, normal, enriched, passing, clip, navigation, and transport states.
- [x] Select the Chord mapper/frame only while an open Chord clip is active.
- [x] Keep rapid bar-select then rhythm-step input synchronized to the newly selected bar.

### Task 11: Verify the Chord extension

- [x] Add command, mapper, LED, clip-selection, and App/hook integration regression tests.
- [x] Run the focused Launchpad and Chord test suite.
- [x] Run the complete test, lint, and production build checks.
- [ ] Physically verify all 16 Chord steps, missing-bar creation, sparse clip navigation, LED variants, quick bar-select then step, and editor-context clearing.

### Task 12: Add long-press Harmony Edit

- [x] Define a 300 ms hold on an existing Chord step; keep empty-step creation immediate and move existing-step deletion to release.
- [x] Add failing gesture tests for short release, long hold, both release encodings, duplicate Note On, and cancellation.
- [x] Add validated open, close, and indexed option AppCommands.
- [x] Map enriched choices to row three and passing choices to row four only for step 15.
- [x] Synchronize the existing webpage harmony popover with the hardware target.
- [x] Extend the amber LED frame with target and option states.
- [x] Add App/hook integration coverage and run focused checks.
- [x] Run the complete test, lint, production build, and browser smoke checks.
- [ ] Physically verify the 300 ms hold/delete feel, Harmony target/option LEDs, and real-device release behavior.

### Task 13: Reuse Capture MIDI for Harmony audition

- [x] Define contextual Capture behavior, temporary candidate state, second-press confirmation, and transport preservation.
- [x] Add failing command, mapper, state, LED, and App integration tests.
- [x] Make a first option press select only and a second press apply through the existing undo path.
- [x] Route Capture MIDI to the live selected candidate only while Harmony Edit is open.
- [x] Show the selected candidate in the amber LED frame and synchronized webpage popover.
- [x] Run focused tests, the complete suite, lint, production build, and browser smoke checks.
- [ ] Physically verify candidate selection, repeated audition, confirmation, cancellation, and normal Capture transport behavior.

### Task 14: Add global track mute buttons

- [x] Define top-to-bottom CC 89/79/69/59 mapping for Drums/Chord/Bass/Melody and preserve slider values.
- [x] Add failing store, command, mapper, LED, dispatcher, and audio tests.
- [x] Add independent `mutedTracks` state and validated `track.toggleMute` commands.
- [x] Apply mute to transport and every preview path, including an immediate live-node refresh.
- [x] Add four mute LEDs to both complete surface frames and redraw on mute changes.
- [x] Run focused tests, the complete suite, lint, production build, and browser smoke checks.
- [ ] Physically verify all four buttons, release filtering, sound cutoff, volume restoration, LEDs, and reconnect recovery.

### Task 15: Add Melody template audition and sequential capture

- [x] Map rows one and two to 16 Melody Steps, rows four through six to the selected scale, and the bottom row to Melody clips.
- [x] Add overview, optional audition, Step edit, confirm, and sequence capture phases.
- [x] Keep template application metadata-only and hide scale Pads until edit or audition begins.
- [x] Buffer ordered presses without timing and atomically replace the bar only after all template notes arrive.
- [x] Preserve the Note On pitch mapping through Note Off and clear held-input state on scale, clip, blur, and disconnect boundaries.
- [x] Add phase-aware Step and scale feedback plus global transport, clip, navigation, and mute LEDs.
- [x] Preserve the existing no-template count-in recording path.
- [x] Add command, mapper, LED, matrix, audio-release, and UI regression coverage.
- [x] Run focused tests, the complete suite, lint, and production build.
- [ ] Physically verify both scales, manual Step editing, overlapping/repeated presses, cancel/confirm, atomic undo, manual playback, and reconnect recovery.

### Task 16: Separate Melody audition, writing, transport, and audio voices

- [x] Restore Capture MIDI to global play/pause throughout the Melody workflow.
- [x] Add an independent webpage Free Audition toggle and make Write start sequence capture directly.
- [x] Return template apply, manual Step entry, cancellation, and completed sequence capture to overview.
- [x] Remove automatic one-bar preview and leave transport at the selected bar start after commit.
- [x] Isolate manual Melody input in a second sampler that shares track volume and mute state without sharing release lifecycle.
- [x] Update Melody LEDs so Capture reflects transport and the normal playhead remains visible during manual playback.
- [x] Add focused command, mapper, LED, workflow, and audio-isolation regressions.
- [ ] Physically verify Capture transport, optional audition, direct write, manual playback after commit, mute, and repeated Melody use across clips.

### Task 17: Let every Melody sound retain its natural sample tail

- [x] Route every matrix Melody duration through a dedicated lazy one-shot sampler attack.
- [x] Route audition, Step edit, sequence capture, realtime recording, keyboard, and webpage previews through input one-shots.
- [x] Allow overlapping one-shot tails, preserve them through Pause, and release them on Stop.
- [x] Separate held-input cleanup from voice release so normal workflow transitions do not cut tails.
- [x] Keep `durationSteps` as matrix and Piano Roll metadata without using it as an audio gate.
- [x] Cover matrix, manual input, sequence preview, overlap, Pause, Stop, mute, and volume behavior in AudioEngine tests.
- [ ] Physically verify natural Melody tails at the default BPM and with dense repeated notes.

### Task 18: Make Melody sequential capture event-safe

- [x] Store the live capture buffer and completion latch in a synchronous session ref.
- [x] Mirror session progress into React state only after each event has been accepted.
- [x] Accept overlapping different-note presses while filtering repeated Note On for a still-held Pad.
- [x] Commit exactly once after N notes and keep the original matrix untouched before completion.
- [x] Pause and seek after commit without truncating the final captured sample.
- [x] Add a four-event same-render regression plus overflow and duplicate-completion coverage.
- [ ] Physically verify the four-note `四十六` template with fast and overlapping input.

### Task 19: Share the dynamic Melody keyboard across webpage, QWERTY, and Launchpad

- [x] Replace the fixed numeric chromatic shortcut row with three QWERTY rows for octaves 5, 4, and 3.
- [x] Centralize scale columns, physical key codes, Launchpad notes, and workflow visibility in one shared layout model.
- [x] Give keyboard, virtual, and Launchpad inputs stable source-specific IDs and reference-count same-note holds.
- [x] Mirror active notes between the webpage keyboard and Launchpad LED frame in both directions.
- [x] Ignore disabled scale columns and hidden template phases before audio or recording side effects.
- [x] Migrate Melody tutorial examples to the new QWERTY layout.
- [x] Run focused tests, the complete suite, lint, production build, and browser workflow checks.
- [ ] Physically verify QWERTY-to-LED, Launchpad-to-web highlighting, multi-source holds, scale changes, and reconnect redraw.
