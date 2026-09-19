import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3605',
  date: '2026-09-18',
  title: "Sub portal: a payment the office moved or removed leaves a crossed-out line, so it never just vanishes",
  kind: 'feature',
  highlights: [
    "On a sub's Work & pay page, a payment the office moved to another of their sheets or removed now shows as a crossed-out line where it was — 'Moved to #922 by the office' or 'Removed by the office' — instead of disappearing with the open balance jumping.",
    'The line says what happened and that the office did it, never the internal reason; the destination sheet lists the payment itself, and the totals do not count the crossed-out lines.',
    'In Spanish too, like the rest of the page.',
  ],
}

export default note
