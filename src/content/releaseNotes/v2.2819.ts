import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2819',
  date: '2026-09-05',
  title: 'Jobs → Work Orders: assemble a sub work order like a cover letter',
  kind: 'feature',
  highlights: [
    'New Work Orders tab on Jobs, between Team Labor and Sub Labor: every sub work order on one board — drafts, awaiting signature, signed, declined, expired — with a "Needs a work order" list of jobs that have unpaid sub labor and nothing signed.',
    'The assembler walks Job → Sub → Scope and terms with a live preview of the numbered document; scope comes from the trade library and the job\'s bid, the price hint from the bid\'s sub-labor line.',
    'Drafts can wait for a price; Send for signature mints WO-<job>-NN and the sub signs on their portal. When they sign a job work order, their Sub Labor sheet is created from the agreed amount.',
    'From the board: Nudge, Withdraw, Signed on paper, Discard a draft, Re-offer a decline, and Print / PDF of the signed record.',
  ],
}

export default note
