# Launchpad X Input Design

## User Experience

The top bar keeps the existing user-triggered Launchpad connection control and three-byte raw MIDI monitor. Connection also unlocks browser audio while user activation is available. The status distinguishes a fully connected device from an input-only connection whose LED output is unavailable.

The user manually selects Programmer Mode. Capture MIDI toggles play/pause except while Harmony Edit is open, where it auditions the selected candidate without changing transport state. Stop Clip stops globally before returning transport to bar 1, step 1. The four right-side buttons above Stop Clip use CC 89/79/69/59 for Drums/Chord/Bass/Melody mute. With a Drums clip open, the top six rows edit a full 16-step bar, row seven previews Kick, Snare, and Hi-Hat, and the bottom row selects bars 1–8. With a Chord clip open, the top two rows edit all 16 Chord rhythm steps, rows three through seven are disabled, and the bottom row selects Chord bars 1–8. The top-row left/right buttons cycle existing clips for the active context. Leaving both supported editors clears grid and navigation LEDs without clearing transport or mute LEDs.

Chord templates and preview controls remain in the pointer UI. The controller adds a temporary Harmony Edit layer for enrichment and passing selection, synchronized with the existing webpage popover. Chord uses amber variants; blue and purple remain reserved for later Bass and Melody layouts.

## Data and State

Connection state remains local to the Web MIDI React hook and is not persisted in the music store. The hook receives a read-only surface context containing `drumsActive`, `drumsClipBars`, `chordActive`, `chordClipBars`, `selectedBar`, `matrix`, `isPlaying`, and `mutedTracks`; it exposes status, device name, output availability, the last raw message, and a user-triggered connect action. `mutedTracks` is a four-key boolean map stored separately from `volumes`, so unmute restores the exact prior slider value.

MIDI bytes are parsed by pure functions. A context-aware pure mapper emits AppCommands only for press messages:

- Step pads emit `drums.toggle` with the selected bar, step, and instrument.
- Preview pads emit `drums.preview` with the instrument only.
- Bottom-row pads and resolved CC 93/94 navigation emit `drums.selectClip` with a zero-based bar.
- Chord rows one and two emit `chord.toggleRhythm` with the selected bar and step.
- Chord bottom-row pads and resolved CC 93/94 navigation emit `chord.selectClip` with a zero-based bar.
- A 300 ms hold on an existing Chord step emits `chord.openHarmony`; releasing earlier emits the normal `chord.toggleRhythm` deletion.
- A first Harmony option press emits `chord.selectHarmonyOption` using bar, step, mode, and option index; pressing the same selected option emits `chord.applyHarmonyOption`.
- Capture MIDI emits `chord.previewHarmonyOption` with the selected option while Harmony Edit is open, otherwise it emits `transport.togglePlay`.
- CC 89/79/69/59 emit `track.toggleMute` for Drums/Chord/Bass/Melody.
- Stop Clip emits `transport.stopAndRewind`; keyboard and pointer stop controls retain `transport.stop`.

The shared UI-aware input dispatcher intercepts `drums.toggle` and invokes `handleDrumsStepToggle`, preserving tutorial checks, undo checkpoints, matrix mutation, and the existing sound preview. `drums.preview` reaches the validated command dispatcher and triggers audio without a store handler. `chord.toggleRhythm` invokes the existing Chord rhythm toggle with live-bar validation and an undo checkpoint. `chord.openHarmony`, `chord.closeHarmony`, and `chord.selectHarmonyOption` own only temporary UI targeting. `chord.previewHarmonyOption` resolves the live candidate and reuses the existing harmony preview audio without stopping transport. `chord.applyHarmonyOption` resolves the candidate again and reuses the existing enrichment/passing actions. `track.toggleMute` flips only the requested store flag, then refreshes the live audio node volume immediately; mute is an operational mixer state and does not create an undo checkpoint. `drums.selectClip` and `chord.selectClip` use a shared track-aware selection policy: select an existing clip or create a missing one inside an undo checkpoint after the tutorial clip-open guard accepts it.

Before dispatching either clip-selection command, the hook updates its selected-bar ref optimistically. The App validates Drums and Chord step commands against the live store and passes the command bar explicitly into each toggle handler. A rejected selection restores the ref. This prevents a rapid select-then-step sequence from writing into the previous bar.

## Surface Mapping

The mapping table is a shared pure surface definition used in both input decoding and LED construction. Row bounds are explicit rather than inferred from note arithmetic across the unused seventh row.

| Instrument | Steps 1–8 | Steps 9–16 | Empty | Active |
|---|---:|---:|---:|---:|
| Kick | Note 81–88 | Note 51–58 | 43 | 41 |
| Snare | Note 71–78 | Note 41–48 | 7 | 5 |
| Hi-Hat | Note 61–68 | Note 31–38 | 11 | 9 |

Preview pads 21–23 use the active colour for their instrument; notes 24–28 are zero. Notes 11–18 represent bars 1–8: existing clips use dim green 23, the selected clip uses bright green 21, and missing clips use zero. CC 93/94 use dim green 23 when at least two Drums clips can be paged and zero otherwise. Capture MIDI CC 98 uses 23 when stopped and 21 while playing; Stop Clip CC 49 uses 7.

Track mute LEDs are present in every surface frame and always retain track identity. Unmuted Drums/Chord/Bass/Melody use bright lime-green/amber/blue/purple values 17/9/41/49; muted tracks use the matching dim values 19/11/43/51. Drums intentionally uses the warmer 17/19 pair because the Launchpad X hardware renders 21/23 too blue-green beside Bass. The four messages are CC 89/79/69/59 respectively.

Chord uses Note 81–88 for steps 1–8 and Note 71–78 for steps 9–16. Its step colours are dark amber 11 for empty, orange-amber 9 for a normal hit, gold 13 for an enriched hit, and pale orange 8 for a passing chord. Notes 21–68 outside the top two rows are zero. Chord clip selection and navigation reuse the same green states as Drums so transport and bar-location semantics stay consistent.

For an empty Chord step, Note On still toggles immediately. For an existing step, Note On starts a 300 ms pending gesture. Matching Note Off before the deadline emits one toggle; reaching the deadline opens Harmony Edit and the later release does nothing. This is handled by a release-aware gesture controller rather than changing Drums or transport release rules.

Harmony Edit keeps the selected target bright gold. Note 61 onward exposes the source chord followed by live enriched variants, and Note 51 onward exposes live passing options only for step 15. Unused option pads remain zero. The layer stays latched after the held pad is released, allowing one-handed selection. It initializes its candidate to the currently applied chord. Pressing an option once moves the candidate without touching the matrix; Capture MIDI previews it; pressing the selected option again confirms through one undo checkpoint and closes. The selected candidate is bright gold, while the previously applied option falls back to an amber current-state colour. Capture MIDI also turns bright amber to communicate its temporary role. Pressing the target again cancels; pressing another active Chord step retargets and resets the candidate; bar/clip/context changes close the layer.

## MIDI Output

Static LED feedback uses ordinary channel-1 messages and never requests SysEx:

- Grid buttons: `0x90`, note, palette value.
- Top/right-side buttons: `0xB0`, CC, palette value.

Every redraw emits a complete 8×8 grid plus clip navigation, transport, and four track-mute buttons. A complete frame makes context changes and reconnect recovery deterministic. The active editor selects the Drums, Chord, or Melody frame builder. Redraw triggers are the selected bar, existing clip bars, matrix, playback state, Melody workflow state, scale, mute state, editor activity, and output reconnection.

## Melody Template Input

Melody uses `overview`, optional `audition`, `step-edit`, `confirm`, and `sequence-capture` phases alongside the existing no-template count-in recording. Rows one and two map Steps 1–16. Rows four through six map the webpage-selected scale over octaves 5, 4, and 3. Row three and row seven remain zero; row eight selects Melody clips.

The webpage virtual keyboard, computer QWERTY input, and Launchpad rows four through six consume the same 3×8 layout model. `QWERTYUI`, `ASDFGHJK`, and `ZXCVBNM,` map octaves 5, 4, and 3; natural major enables seven columns and pentatonic enables five. Each press carries a stable `keyboard:`, `virtual:`, or `launchpad:` input ID. The recording controller owns the shared active-note set, so a web or QWERTY press brightens the matching Launchpad Pad and a Launchpad press highlights the web key. Multiple sources holding the same note keep feedback active until the last source releases without duplicating capture.

Applying a template enters `overview`, where scale rows are zero. A template Step press enters `step-edit`; the next scale-pad press writes that Step through one undo checkpoint and returns to overview. A separate webpage Free Audition toggle owns `overview ↔ audition` and never writes. The webpage Write button starts confirmation or sequential capture directly from overview, audition, or Step edit. Capture MIDI always emits `transport.togglePlay` and never changes Melody workflow state.

Sequential capture stores notes outside the matrix in a synchronous capture session rather than using rendered React state as the event buffer. Every new Note On is accepted in arrival order even when a different Pad is still held; a repeated Note On for the same held Pad is ignored until Note Off. The session owns its bar, template Steps, note buffer, and completion latch, while React state mirrors progress for UI and LEDs. `recordedNotes` is the cumulative count across the requested bar range, while `barRecordedNotes` resets for each bar and exclusively drives the current bar's captured and next-target Step LEDs. When the buffer reaches the template length, the latch prevents duplicate commits, one undo checkpoint replaces the bar, transport pauses and seeks to the selected bar start, and the workflow returns to overview without automatic playback. Cancelling confirmation or capture preserves the original bar and invalidates the session.

Melody Step LEDs always render the complete 16-Step grid. The edit/next-capture target uses white 3, the normal transport playhead uses green 21, every written or captured Step uses bright purple 49, empty template Steps use medium purple 51, and all other empty Steps use dark purple 55. The white target and green playhead take priority over content colours. Non-template Steps retain their existing input behavior: their dark background is positional feedback and does not make them selectable. Scale Pads use dark blue 43 and switch to bright blue 41 while held; columns outside the selected scale stay zero. Capture uses the global stopped/playing green transport colours only.

Manual Melody input uses a dedicated sampler with the same samples, volume, and mute state as matrix Melody playback. Free Audition, Step editing, sequential writing, realtime recording, keyboard input, and webpage sequence previews all use `triggerAttack`; Note Off only clears held-input state. Scale, audition exit, blur, disconnect, clip/context, and completed-write cleanup clear gesture tracking without releasing the sampler, so natural tails finish. Global stop, Stop Clip, Melody mute, and teardown release all Melody samplers, while ordinary input cleanup can never call `releaseAll` on a matrix sampler.

Matrix Melody playback always uses a dedicated lazy one-shot sampler and never schedules a Step-boundary release, including cells whose `durationSteps` value is greater than one. `durationSteps` remains intact for Piano Roll rendering and future articulation work. Consecutive and repeated one-shots may overlap; Pause stops future scheduling without cutting tails, while Stop releases matrix and input samplers.

## Components or Modules

- `launchpadXProtocol.js`: parse Note On, Note Off, and Control Change messages.
- `launchpadXDrumsSurface.js`: own the Drums note layout, palette values, note lookup, and complete LED-frame builder.
- `launchpadXChordSurface.js`: own the two-row Chord rhythm layout, amber state palette, clip navigation, and complete LED-frame builder.
- `launchpadXChordGesture.js`: distinguish immediate empty-step creation, short-release deletion, and 300 ms long-press Harmony entry.
- `melodyInputLayout.js`: own the three-octave QWERTY, virtual, and Launchpad scale mapping plus workflow visibility.
- `launchpadXMelodySurface.js`: own Melody Step, clip, phase palette, and complete LED-frame rules while consuming the shared scale layout.
- `launchpadXPorts.js`: select matching LPX/Launchpad X MIDI input and output ports while excluding DAW ports.
- `launchpadXMap.js`: map pressed messages plus editor context to AppCommands.
- `useLaunchpadXCommands.js`: request permission, bind input/output, react to hot plug, send LED frames, and expose UI state.
- `HardwareInputStatus.jsx`: render connection, raw messages, and input-only degradation.
- `launchpadClipSelection.js`: enforce active track context, tutorial approval, select-or-create behavior, undo, and hardware-selection seek.
- `launchpadDrumsClipSelection.js` and `launchpadChordClipSelection.js`: bind that shared selection policy to a track.
- `useMelodyRecordingController.js`: own optional Melody audition, manual Step edit, buffered sequence capture, and atomic commit.
- `App.jsx`: share the keyboard/hardware policy and supply the current editor context.

## Edge Cases

- Unsupported browser: show a disabled unsupported state.
- Permission denied: show a retryable denial state.
- Permission granted with no LPX input: show disconnected and keep listening for hot plug.
- Input present but output absent or unable to open: keep input connected and report LEDs unavailable.
- LPX DAW and LPX MIDI both present: bind only the MIDI ports.
- Note On velocity zero, explicit Note Off, CC value zero, and aftertouch: do nothing.
- Chord step releases are consumed only when they finish a pending active-step gesture; every other release remains ignored.
- Context changes while connected: use the latest selected bar and editor state for input and LEDs.
- Direct selection of a missing bar: create one empty clip for the active Drums or Chord context; selecting it again never duplicates it.
- Left/right navigation: skip missing clips, wrap across the sparse existing list, and do nothing with fewer than two clips.
- Hardware bar selection: seek to the selected bar at step zero while playing or stopped; skip the seek only when transport is already at that exact start position.
- Rejected tutorial selection: restore the optimistic MIDI context and reject following stale-bar edits.
- A held target removed by pointer/undo or invalidated by a context change: cancel the pending timer or close Harmony Edit without applying a stale option.
- A selected Harmony option removed by a live matrix/context update: fall back to the current option, or the first available enrichment, before mapping Capture MIDI.
- Capture MIDI during Harmony Edit: preview only the live selected option and preserve the current transport play/pause state.
- Track mute: preserve the stored dB volume, silence current and future track audio, restore the stored dB value on unmute, and ignore CC releases.
- Component unmount or port replacement: remove the prior listener and discard stale output-open results.

## Context Extension Boundary

Connection and transport behavior are editor-agnostic. Drums and Chord own only their surface mapping and frame content. Bass and Melody can later reuse the same hook lifecycle by adding their surface contexts and choosing the relevant pure mapper/frame builder from the active editor; inactive layouts must always ignore their input and clear their owned LEDs. Blue/purple is reserved for those surfaces, while Chord keeps amber.

## Test Strategy

- Unit-test all row boundaries, moved preview pads, direct bar pads, sparse clip navigation, inactive contexts, releases, aftertouch, and transport CCs.
- Unit-test complete LED frames for empty/active steps, preview pads, clip states, navigation buttons, transport state, inactive clearing, and unused notes.
- Unit-test select-or-create, undo checkpointing, tutorial rejection, inactive context, duplicate prevention, and playing/stopped hardware-selection seek.
- Unit-test macOS/Windows input and output names, DAW exclusion, and disconnected ports.
- Unit-test `drums.preview` validation and audio-only dispatch.
- Unit-test Chord row boundaries, unused rows, amber step variants, direct create, sparse navigation, inactive context, and rapid selection safety.
- Unit-test the exact 300 ms boundary, both Note Off encodings, one deletion per short gesture, no deletion after long press, cancellation on context change, option bounds, first-press selection, second-press apply, contextual Capture preview, transport preservation, LED selection, and synchronized popover targeting.
- Unit-test all four track-mute CC mappings, exact command payloads, store toggling, slider preservation, immediate audio refresh, live preview/transport muting, and mute LED states in active and inactive editor contexts.
- Add source-level coverage for latest-context mapping, output rebinding, LED redraw, UI degradation, and routing through `handleDrumsStepToggle`.
- Run the complete test, lint, production build, and physical hardware acceptance checks.
