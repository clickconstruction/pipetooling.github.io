import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3305',
  date: '2026-09-11',
  title: 'Banking is controller and above',
  kind: 'fix',
  highlights: [
    'Banking — the bank feed, User Sort, Drag Sort, Accounting approvals, Card Review, Category Review, Reconciliation and Visuals — now opens for dev, master technician and controller only. Assistants no longer see the Banking link, the page, or the "bank-label suggestions have waited 3+ days" card on the Dashboard and Quickfill.',
    'The data follows the page: an assistant\'s session can no longer read the accounting label rules and suggestions, org notes, reconcile receipts or card-to-person links, and cannot rename cards or accounts.',
    'Nothing else moves. Assistants still sort their own purchases in Job Parts Tally, match bank deposits to bills on the Jobs board, split card charges to jobs, and work Accounts Receivable exactly as before.',
  ],
}

export default note
