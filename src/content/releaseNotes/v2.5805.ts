import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5805',
  date: '2026-10-23',
  title: 'Quickfill: the Percent complete card’s bar is the slider for the % done',
  kind: 'feature',
  highlights: [
    'On Quickfill’s Percent complete station, drag the blue knob along the card’s stage bar to set the % done, or tap anywhere on the bar. The dark tick stays where the job is today, so the move is in view before Save writes it.',
    'Under the bar, one chip per stage end and one for the paid share when it is not a stage end. Press Top Out 75% and the knob jumps there. The box still takes an exact number, and the knob follows it. On a keyboard the arrow keys walk the knob.',
    'A line beside the box reads the move, 0% → 57% ▲ 57, and Save names the number. When the knob sits where the job already is, the line reads no change and Save goes grey.',
    'Nothing changed about what a save writes, what Dismiss for one week does, or who sees the station.',
  ],
}

export default note
