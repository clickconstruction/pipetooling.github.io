import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2540',
  date: '2026-08-31',
  title: 'No call, no show — right from the schedule',
  kind: 'feature',
  highlights: [
    'The Add-job window on the Schedule page now has a "No call, no show" link next to "Not coming in today" (office roles only).',
    'One confirm does the whole thing: files the attendance incident (shows up in write-ups and review), rejects any clock time for the day, clears their schedule blocks, and marks the day off. You can add a note about what happened.',
    'The day then shows a solid red NCNS chip on the board. Clicking it clears the schedule mark if plans change — the incident itself stays on record.',
  ],
}

export default note
