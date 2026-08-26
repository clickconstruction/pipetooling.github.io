import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2318',
  date: '2026-08-25',
  title: 'Portal statements group bills by job',
  kind: 'feature',
  highlights: [
    'The customer portal statement now reads job by job: each job opens with its own header band, with all of its bills and payments together underneath — no more progress bills scattered between other properties.',
    'Every job with activity closes with a boxed recap on the right — Billed to date, Paid to date, and Balance on this job — the same totals box customers already see on invoices.',
    'Bills with payments show the originally billed amount, payments read as credits, and the catch-all method "other" now prints as "Payment".',
  ],
}

export default note
