import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1982',
  date: '2026-08-21',
  title: 'Customer portal — the statement page',
  kind: 'feature',
  highlights: [
    'New no-login portal page for customers and GCs: a private link opens their account statement — open bills set like a ruled ledger, each with a Pay online button (or check reference), and a balance-due total.',
    'Links are minted per customer, revocable and rotatable, and only a fingerprint of the link is ever stored.',
    'This is part 1 of the portal: schedule/bid request forms, notifications, and the globe entry points land in the next releases.',
  ],
}

export default note
