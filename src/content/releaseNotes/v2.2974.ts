import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2974',
  date: '2026-09-07',
  title: 'Jobs → Team: the crew board, planned against clocked',
  kind: 'feature',
  highlights: [
    'Team Labor is now Team, the in-house twin of Subs. One week at a time, every job is a row and every day a column; each chip is one person\'s clocked hours on that job with the dispatch block drawn under it, so late starts, early leaves and afternoon moves read at a glance.',
    'Green means the clock landed where dispatch put it; amber means clocked with nothing on the plan (or ran long past the block); red-dashed means planned with no punch. Hours with no job at all sit in the top row with the dispatch suggestion for that person and day.',
    'Board or Ledger: the Ledger lists every person-day-job like a sub sheet, with a "where it stands" pill in the Subs vocabulary. Rows can be jobs or people, and "Only exceptions" collapses the board to what needs a look.',
    'The old per-day Crew Jobs / Bids matrix and the per-job Team Job Labor table leave this tab (Quickfill keeps its copy). Man hours and cost per job stay on Pipeline and Job Summary.',
  ],
}

export default note
