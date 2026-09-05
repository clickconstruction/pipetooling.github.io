import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2881',
  date: '2026-09-05',
  title: 'Click the rail: the sheet\'s story, one row per dot',
  kind: 'feature',
  highlights: [
    'Click a sub sheet\'s rail — on Jobs → Work Orders, Jobs → Sub Labor, or the sheet\'s own Work order box — and a story opens: one row per dot with the facts behind it. Drafted, Sent and Signed read the work order (who drafted it, when it went out and until when, how it was signed, what paperwork it binds under). Work, Walk-through, Customer pays and Paid read the sheet, the Activity feed\'s Sub labor lines (who moved it, portal or office, the sub\'s note), the job\'s bill, and every payment.',
    'Each row shows what the sub sees on their portal at that step, and the live step carries the office\'s move: Draft a work order…, Nudge, Re-offer…, Move to Walk-through, Passed → Customer pays, Set payable after…, Sheet ›. Stage moves and the payable-after date save right there and post to the feed like the tabs do.',
    'On Sub Labor the current dot still opens the stage menu; the rest of the rail opens the story. Crew pay sheets tell a four-row story.',
  ],
}

export default note
