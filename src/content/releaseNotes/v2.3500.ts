import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3500',
  date: '2026-09-16',
  title: 'Supply houses: the money screens are ready for credit memos',
  kind: 'fix',
  highlights: [
    'Groundwork for entering a return. Nothing changes on screen yet — the form still only takes invoices.',
    'A supply house will stay on the aging table even when its credits outweigh its invoices, so a past-due balance can never disappear behind a credit.',
    'A credit memo will not be counted as an invoice missing a due date, will not shrink the week-close queue to $0, and will not be dropped from the payables total.',
    'On the paid-job email a credit reads as a charge that came back, not as a customer payment.',
  ],
}

export default note
