import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8731',
  date: '2026-11-27',
  title: 'A job’s burn prices its labor the way the bid did',
  kind: 'feature',
  highlights: [
    'A bid prices a crew hour at the wage times 1.20. A job’s burn counted the same hour at the wage alone, so a job could read on budget while its labor ran a sixth over.',
    'The burn now counts labor at the wage times 1.20 too: what a job has spent, its cost at completion and its margin, on the Costs tab, Job Summary’s Burn column, the Pipeline’s burn card and Bid vs actual.',
    'On the Costs tab the Spent so far tile shows the line behind it, like labor $3,000 wages × 1.20 = $3,600. The Labor row under the margin shows the same wages and factor.',
    'Where the money went, Job Summary’s Labor column, Crew P&L and pay stubs still show the wages paid. A job that read on budget may now read over. That is the two sides measured the same way, not a fault.',
  ],
}

export default note
