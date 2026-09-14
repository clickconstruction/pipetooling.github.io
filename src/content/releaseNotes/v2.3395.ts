import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3395',
  date: '2026-09-14',
  title: 'Subs board polish: five small things seen in the live test',
  kind: 'fix',
  highlights: [
    'Dates on the Work board read as words — “Sent · Sep 8 · good through Sep 14” — instead of raw 2026-09-08 strings, on the rail, the next-move hint and the calendar’s sub line.',
    'Agreed on a sheet with no items yet shows the price its sent or signed work order carries, instead of “unpriced”; Open reads against it.',
    'Offers out no longer opens a live offer on the Re-send form when you arrive — only an expired one opens; live rows stay collapsed until you click them.',
    'Undo after a send says what happened — “Withdrawn · draft kept” — with a Discard beside it; the stage calendar’s “Stages on this job” list no longer repeats the sub’s name as the stage.',
  ],
}

export default note
