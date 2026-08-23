import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2190',
  date: '2026-08-23',
  title: 'Quickfill: Billed Awaiting Payment answers "who owes us?"',
  kind: 'feature',
  highlights: [
    'The 60-row flat table is now the Pipeline\'s Who-owes-what: customers ranked by what they owe, with bill count and the oldest bill\'s age. Click a customer for their bills, oldest first — each with a View in Pipeline door.',
    'Same rows and totals as the Pipeline (one row per bill, Collections excluded, hand-set dates marked with a dot), so the two can\'t disagree. The header count is now bills; the dollars sit in the subtitle.',
  ],
}

export default note
