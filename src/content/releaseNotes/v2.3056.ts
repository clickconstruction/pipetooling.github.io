import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3056',
  date: '2026-09-07',
  title: 'Split Bill voids under the bill’s own Stripe mode',
  kind: 'fix',
  highlights: [
    'Splitting a billed invoice into several bills now voids the original under the mode it was created in (test or live) instead of the role default — the recorded mode was never loaded with the job, so the check could not work.',
    'A new guard fails the build if a column is added to a job’s invoices, payments, materials, fixtures or crew tables without a decision on whether the app should load it.',
  ],
}

export default note
