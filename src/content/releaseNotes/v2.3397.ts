import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3397',
  date: '2026-09-14',
  title: 'Jobs on a map: the rail, and rows that point at their pins',
  kind: 'feature',
  highlights: [
    'Beside the Pipeline map, a rail turns the empty land into numbers: three distance boxes — under 25 miles, 25 to 50, over 50 — each with how many jobs are pinned there, the dollars still to collect on them, and how many to ask. Tap a box to hide or show that band’s pins.',
    'Under the boxes, Ask for money lists the billed and ready-to-bill jobs, longest waiting first: “Billed 46 d” in red when the job is in Collections, amber past 30 days, then the nearest first. Tap a row and its pin is selected and the job’s row lights up on the board.',
    'On a desktop, rest the mouse on any Pipeline row and its pin pulses on the map, so you can find where a job is without clicking anything.',
  ],
}

export default note
