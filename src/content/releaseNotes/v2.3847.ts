import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3847',
  date: '2026-09-26',
  title: 'Burn: a half-empty bid figure no longer stands as the whole job’s budget',
  kind: 'fix',
  highlights: [
    'A job linked to a bid whose estimate only carried driving and travel (no labor rate, no materials) read absurd — the Pipeline’s “jobs burning” card had one at “1355% spent at 30% done”, because $609 of driving was being treated as the entire budget.',
    'The Pipeline burn card, Job Summary’s Burn column and the job window’s Costs tab now take a bid or typed figure as the job’s budget only when it has both a labor figure and a materials figure. Until then the job burns against the usual assumption (price × (1 − target margin)), marked ≈, and the Costs tab’s Direct cost row says so.',
    'Each component still reads against whatever the bid did carry — hours, driving, a takeoff — on the Budget card, which now says when the job as a whole is on the assumption.',
  ],
}

export default note
