import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4648',
  date: '2026-10-05',
  title: 'Legal: undo a mistaken fee or payment, with a reason',
  kind: 'feature',
  highlights: [
    'The law firm can undo its own fee, cost or a payment you have not applied yet. The Legal desk can undo a fee, cost or note the office wrote.',
    'Every undo needs a reason. The row stays struck through with the reason, and leaves every total.',
    'Two saves of the same act in the same instant now land once.',
  ],
}

export default note
