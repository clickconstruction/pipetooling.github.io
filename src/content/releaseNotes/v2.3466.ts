import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3466',
  date: '2026-09-14',
  title: 'Bids → Submittals: the submittal package as rows, built from your picks',
  kind: 'feature',
  highlights: [
    'A new Submittals tab after Cover Letter. Build Rev 1 from the picks and every tag on the fixture schedule becomes a row: the specified product, the product from the house you picked, its status (as specified · superseded · equal · alternate · design change · missing · accessory), and the reason and lead time you gave at the pick.',
    'Six tiles say where you stand — rows, as specified, alternates still owing a reason, design changes, missing, cut sheets in. Edit any row in place: status, reason, note, lead time, and the cut sheet as a file and page range.',
    'Drop the house\'s whole submittal PDF once on the revision; New revision carries every row and a Since Rev N column says what changed. Rebuild rows from picks after a change on the compare.',
    'Office and estimator roles; the package PDF, a page strip for the sheets, and sharing with the GC follow in the next releases.',
  ],
}

export default note
