# Launchpad X Input Idea

## Background

Project Arranger already routes keyboard input through validated AppCommands. Launchpad X should join the same command path without coupling MIDI messages to the store or audio engine.

The first hardware slice proved that Chrome can connect to the `LPX MIDI` input, preserve the raw MIDI monitor, and recover from hot plug. Drums and Chord established complete context-aware surfaces. Melody now reuses that infrastructure for rhythm-template audition, manual Step assignment, and unmetered sequential capture while keeping scale and template choice in the pointer UI.

## User Goal

Use Launchpad X as a no-page editor for Drums, Chord, and Melody. Melody separates rhythm from pitch: the top two rows show the selected rhythm template, three middle rows expose the selected scale, and the bottom row selects clips.

## Core Scenario

The user manually enters Programmer Mode, connects Launchpad X from the top bar, and opens a Drums clip. The upper six rows expose all 16 steps at once: the first three rows are steps 1–8 and the next three rows are steps 9–16. Empty steps remain dim in their instrument colour and active steps light brightly. Row seven previews sounds without editing the matrix. The bottom row selects bars 1–8 and creates a missing empty Drums clip when selected directly.

The top-row left and right buttons cycle through existing Drums clips only. Every hardware bar selection seeks transport to that bar's first step, whether playback is running or stopped, so the playhead and edited clip always stay aligned.

With a Chord clip open, rows one and two expose Chord rhythm steps 1–16. Empty steps stay dim amber, normal hits use orange-amber, enriched hits use gold, and passing chords use pale orange. In normal input, rows three through seven remain unused. Holding an existing Chord step for 300 ms opens a temporary Harmony Edit layer: row three selects the source or an enriched variant, and row four selects a passing chord when the target is step 15. The existing webpage harmony popover opens at the same time so the text labels remain visible. The first option press only selects a candidate, Capture MIDI auditions that candidate, and pressing the selected option again confirms it.

Capture MIDI toggles play/pause except while Harmony Edit is open, where it temporarily auditions the selected candidate without changing transport playback state. Stop Clip stops playback globally and returns the transport to bar 1, step 1. The four right-side buttons above Stop Clip toggle global track mute from top to bottom: Drums, Chord, Bass, and Melody. When Bass is active, the current Drums/Chord/Melody contextual grid is ignored and cleared, while transport and track-mute LEDs remain available. Melody owns the reserved purple family.

With a Melody clip open, applying a rhythm template lights only its Step positions and leaves the matrix unchanged in overview. Selecting a Step reveals the current scale across C3–B5; the next pitch press writes that Step once and returns to overview. Free audition is an optional webpage toggle, separate from writing. The webpage Write button starts unmetered sequential capture directly: the user plays only the required number of new presses, and the app assigns them to template Steps in order. Different notes may overlap slightly; a still-held Pad cannot repeat until it is released. Existing content remains untouched until the full sequence is collected, then one undoable replacement is committed and transport pauses at that bar start for manual playback. Capture MIDI remains global play/pause throughout.

Every Melody sound is an attack trigger rather than a short gate: matrix playback, Free Audition, Step editing, sequential writing, realtime recording, keyboard input, and webpage sequence previews all start the full sample as a one-shot. `durationSteps` remains useful for Piano Roll data and rendering but does not shorten audio. Note Off, mode changes, scale changes, clip changes, and completed writes clear held-input feedback without cutting natural tails. Only explicit Stop, Stop Clip, Melody mute, and audio teardown release all Melody voices.

## Must Have

- Use the browser Web MIDI API without SysEx permission.
- Prefer `LPX MIDI` input and output ports and ignore DAW ports.
- Keep input usable when no output is available, and report that LED feedback is unavailable.
- Normalize Note Off and Note On with velocity zero; ignore aftertouch and preserve Melody releases through their Note On mapping.
- Route Drums step presses through the existing tutorial, undo, matrix-edit, and preview path.
- Route Chord rhythm presses through the existing undo and matrix-edit path without moving progression-template controls onto hardware.
- Keep empty-step creation immediate; defer deletion of an existing Chord step until release so a 300 ms hold can enter Harmony Edit without deleting it.
- Keep the Harmony Edit candidate temporary until the selected option is pressed a second time, then apply it through the existing enrichment/passing actions and undo path.
- Reuse Capture MIDI to audition the selected Harmony candidate without mutating the matrix, creating undo history, or changing transport playback state.
- Keep one independent mute flag per track; toggling mute must preserve its volume slider value and affect transport plus all previews.
- Keep instrument-preview commands audio-only.
- Route bar selection through validated commands, tutorial clip-open rules, undo checkpoints, and the current clip model.
- Keep rapid bar-select then step presses targeted at the newly selected clip without waiting for a React render.
- Redraw static LEDs after Drums context, selected bar, matrix, playback, or device state changes.
- Choose the input mapper and complete LED frame from the active Drums, Chord, or Melody editor context.
- Keep keyboard and pointer behavior unchanged when hardware is absent.
- Keep Melody template application metadata-only; never auto-fill notes before a complete sequential capture.
- Clear held Melody Pad mappings on scale, clip, blur, and disconnect boundaries without cutting one-shot tails; release voices on explicit stop, mute, and teardown.

## Hardware Layout

| Location | MIDI | Action |
|---|---:|---|
| Row 1 | Note 81–88 | Kick, steps 1–8 |
| Row 2 | Note 71–78 | Snare, steps 1–8 |
| Row 3 | Note 61–68 | Hi-Hat, steps 1–8 |
| Row 4 | Note 51–58 | Kick, steps 9–16 |
| Row 5 | Note 41–48 | Snare, steps 9–16 |
| Row 6 | Note 31–38 | Hi-Hat, steps 9–16 |
| Row 7 left pads | Note 21, 22, 23 | Preview Kick, Snare, Hi-Hat |
| Row 7 remaining pads | Note 24–28 | Unused and off |
| Bottom row | Note 11–18 | Select Drums bars 1–8; create a missing clip |
| Top left | CC 93 | Previous existing Drums clip |
| Top right | CC 94 | Next existing Drums clip |
| Right side, rows 1–4 | CC 89, 79, 69, 59 | Toggle Drums, Chord, Bass, Melody mute |
| Capture MIDI | CC 98 | Toggle play/pause; audition the selected candidate in Harmony Edit |
| Stop Clip | CC 49 | Stop and return to bar 1, step 1 |

## Chord Hardware Layout

| Location | MIDI | Action |
|---|---:|---|
| Row 1 | Note 81–88 | Chord rhythm, steps 1–8 |
| Row 2 | Note 71–78 | Chord rhythm, steps 9–16 |
| Rows 3–7 | Note 21–68 | Unused and off in normal input |
| Bottom row | Note 11–18 | Select Chord bars 1–8; create a missing clip |
| Top left | CC 93 | Previous existing Chord clip |
| Top right | CC 94 | Next existing Chord clip |
| Right side, rows 1–4 | CC 89, 79, 69, 59 | Toggle Drums, Chord, Bass, Melody mute |
| Capture MIDI | CC 98 | Toggle play/pause |
| Stop Clip | CC 49 | Stop and return to bar 1, step 1 |

In Harmony Edit, Note 61–65 map the source plus available enriched variants and Note 51–53 map available passing chords. Passing choices light only for step 15. One press selects a candidate, Capture MIDI auditions it, and a second press on the same candidate applies it and closes the layer. The selected option and Capture MIDI use bright amber feedback. The target pad cancels without applying. Progression-template selection and its full-phrase preview remain pointer-only.

## Melody Hardware Layout

| Location | MIDI | Action |
|---|---:|---|
| Row 1 | Note 81–88 | Melody rhythm Steps 1–8 |
| Row 2 | Note 71–78 | Melody rhythm Steps 9–16 |
| Row 3 | Note 61–68 | Unused and off |
| Rows 4–6 | Note 51–58, 41–48, 31–38 | Current scale in octaves 5, 4, and 3 |
| Row 7 | Note 21–28 | Unused and off |
| Bottom row | Note 11–18 | Select Melody bars 1–8 |
| Top left/right | CC 93/94 | Previous/next existing Melody clip |
| Capture MIDI | CC 98 | Toggle play/pause in every Melody workflow phase |
| Stop Clip | CC 49 | Cancel temporary Melody state, stop, and return to project start |

Natural major maps C/D/E/F/G/A/B to columns 1–7. Pentatonic maps C/D/E/G/A to columns 1–5. Remaining columns are off and emit no commands. The scale is selected from the webpage.

The two Step rows always show a three-level purple grid: dark purple for ordinary empty Steps, medium purple for empty template positions, and bright purple for written or provisionally captured positions. White marks the current edit or capture target, and green marks the transport playhead. Non-template Step input remains disabled despite its positional background. The three scale rows use dark blue for available notes and bright blue while a note is held, keeping pitch performance visually separate from the purple rhythm area.

The same columns now drive a 3×8 webpage keyboard and computer QWERTY rows `QWERTYUI`, `ASDFGHJK`, and `ZXCVBNM,`. All three surfaces share one activity registry: keyboard or pointer input brightens the matching Launchpad Pad, Launchpad input highlights the webpage key, and same-note holds from multiple sources clear only after the last source releases. Overview and confirmation hide and reject the note area before sound or data mutation.

## Not Yet

- Playback-head chase lights.
- Velocity-sensitive editing or preview.
- Bass mapping.
- Automatic Programmer Mode switching or SysEx.
- Multiple simultaneous Launchpad devices.

## Bass Follow-up Boundary

The Web MIDI connection, port selection, raw-message monitor, output writer, transport mapping, and redraw lifecycle are shared infrastructure. A later Bass layout should add its own pure mapper and LED builder selected by editor context; it must not add a second MIDI connection or bypass AppCommands. Bass keeps the reserved blue family, while Melody owns purple and Chord owns amber.

## Success Criteria

- Every one of the 48 drum step pads maps to the correct instrument and step.
- Note 21–23 previews sound without changing the matrix.
- Note 11–18 selects bars 1–8, with current/existing/missing clip LED states.
- CC 93/94 cycles through sparse existing Drums clips and wraps at either end.
- A step pressed immediately after bar selection writes to the newly selected clip.
- Drum input is active only for an open Drums clip.
- Capture MIDI and Stop Clip work in every editor; Capture switches from transport to candidate audition only while Harmony Edit is open.
- CC 89/79/69/59 toggle Drums/Chord/Bass/Melody mute globally, preserve each track volume, ignore releases, and remain lit in every editor context.
- LEDs reflect the current Drums bar and playback state, clear when Drums closes, and recover after reconnect.
- Input remains functional and the top bar explains the degraded state if no output port exists.
- Chord rows one and two map steps 1–16; rows three through seven never edit or preview anything.
- Chord bottom-row and CC 93/94 navigation follow the same direct-create versus existing-only rules as Drums.
- Chord LEDs distinguish empty, normal, enriched, and passing steps in the amber family.
- Rapid Chord bar selection followed by a rhythm press writes only to the newly selected Chord clip.
- Releasing an existing Chord step before 300 ms deletes it exactly once; holding through 300 ms opens Harmony Edit and never deletes it.
- Selecting a Harmony candidate does not change the matrix; Capture auditions it without changing transport, and pressing that candidate again applies it once.
- Applying or cancelling Harmony Edit, changing bar/clip, or leaving Chord clears the candidate and restores the normal surface deterministically.
- Melody template application and manual Step entry return to overview; only the separate webpage audition toggle reveals pitches without writing.
- Melody Write begins sequential capture directly, commits once, and waits at the selected bar start without automatic playback.
- Releasing Melody input voices never releases or disables future matrix Melody playback.
