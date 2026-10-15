# Jam single-track template authoring

Jam opens onto four borderless instrument renders, each with the active project's compact saved templates.
Click an instrument to create a phrase, save several variations without leaving the editor,
then collapse editing and select one saved template per track to perform a combination.
The instrument images move and shrink into a persistent top strip; all four tracks and
their templates remain available above the editor. Reduced-motion users skip the transition.
The previous section sequence, section repetition, combination export, and effect recording
are no longer shown. Live mix, pitch, reverb, repeat, chopper, brake, and arpeggio remain.

## Drum source

The Session View of `Dial Loop Demo - Drum.als` supplies a 5×5 grid of strength and groove
presets. Each is one 4/4 bar at source tempo 100 BPM. The imported 25 presets contain 406 hits.
`drumHits` retains velocity, fractional sixteenth offset, and duration, including two
hi-hat hits in one step in the strongest/busiest preset. The source drum-note role mapping
is 41→kick, 39→snare, 42→hi-hat. Playback uses the application's selected drum bank, not
Ableton's kit, routing, or effects.

Regenerate with Python's standard library:

```sh
python3 scripts/extract_dial_drums.py '/path/to/Dial Loop Demo - Drum.als'
```

Changing either knob replaces the entire pattern. Manual step edits and knob gestures are
undoable; deleting a step removes all hits of that instrument in that step. Other instruments
currently use existing phrase sources with timbre choice and phrase preview.

## Storage and creation

The v2 Jam project library stores per-track templates, instrument timbre overrides, the selected combination, mix,
arpeggio notes, and independent editor drafts per track. Existing single-draft projects adopt that draft
without losing its exact notes. Switching tracks and collapsing the editor retain drafts;
only Save creates or updates a template. An active-context pointer allows homepage navigation
between Jam and creation to retain the same project. The v1 keys remain untouched; saved
legacy sections migrate into deduplicated track templates, without section automation.

Creation's “我的模板” picker works on empty tracks and existing editors, previews a template,
and applies its complete phrase starting at the selected bar. Occupied destinations require
confirmation. Applied clips are deep copies; later template edits/deletion do not change them.

## Template controls and audition

Single-click selects and plays a template; clicking the selected template again clears
that track. During playback, cancellation takes effect on the next sixteenth and keeps
other tracks and musical phase; clearing the last track stops playback. Cancelling while
stopped never starts the other selected tracks, and cancellation during sound preparation
cannot start stale audio. Mouse, keyboard and Launchpad share this toggle behavior.
Retained drafts cannot reinsert a deselected track when another template is triggered.
Templates are fixed 56×56px squares showing only their names, without a score preview or bar count. New unnamed
templates use compact names such as 鼓1 and 鼓2; existing custom names are preserved.
Names are centered in both axes; the overlay tools reserve no space or move the text.
Hover or focus reveals separate pencil and × buttons at the top of the square without
resizing it (always visible on touch devices). Long names use up to two lines with a full-name tooltip.
The pencil (or F2 / Alt+Enter) opens the editor without starting playback or replacing
the playing combination. Double-click no longer opens editing. Rename using the editor's
name field and Save changes; typing a name does not update audio. The × opens a delete confirmation.
Each instrument has a separate mute toggle. A conflicting unsaved draft is protected
when opening a different saved template of the same instrument.

The quiet timbre text beside each instrument name on the overview is a dropdown;
there is no timbre selector in template editing. A timbre change applies to that
instrument across template auditions and solo, without changing notes or rewriting
existing saved templates. It updates a playing combination on the next sixteenth and
does not start a stopped transport. New template saves capture the current instrument
timbre for use in creation. The instrument choice persists per project; old projects
inherit their saved template sounds until the user makes an explicit instrument choice.

Both themes fit the overview and all four editors at 1024×600, 1024×720 and 1280×720.
Saved template lists stay on a single horizontally scrolling row. Below 840px wide,
the effect controls open in a closable side panel rather than stacking below the editor.

The Solo button starts audio even when transport is stopped, temporarily bypasses the
track's mute and muted-volume setting, and schedules only that instrument. Toggling it
off stops a solo started from silence or resumes the combination that was already playing.
Audio preparation can be cancelled without stale playback. The drum editor and creation
mode share DrumStepGrid; other phrase previews reuse the existing PianoRoll.

## Hardware and AI screen

Launchpad's upper four rows trigger the active page of saved templates, eight per track.
Left/right page buttons page the template banks together; empty slots and the former
section/record row stay dark. Existing effect pages remain available. New authoring knobs
and the AI controls have no pad mapping.

The AI BPM knob retains the existing 40–240 integer tempo behavior. The key selector uses
the same knob with 12 chromatic roots and a major/minor toggle. It is UI-only, without transposing or changing music
metadata, playback, or AI requests.

The result page fits the full preview, advice, matching knobs, four instrument choices, and
continuation actions in desktop viewports of 1024×720 and 1280×720. Long descriptions have
an expandable dialog; narrow or unusually short windows use a scrolling layout.

The homepage, AI input, and analysis preview use the result page's compact 56px header,
typography, and page margins. The AI form is at most 760px wide, with a 140–200px text
input and bounded media previews. Actions follow their content rather than sticking to
the bottom of the viewport; long text scrolls within its input or preview. The input and
three-stage analysis fit at 1024×600, with a compact stacked analysis layout on narrow
screens. Analysis timing and the result layout remain unchanged.
