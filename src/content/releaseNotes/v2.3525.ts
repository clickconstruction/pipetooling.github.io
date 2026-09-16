import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3525',
  date: '2026-09-16',
  title: 'Card refunds net on the database side too — aging, paid profit, partner ledgers, baselines and the paid-job email',
  kind: 'fix',
  highlights: [
    'The second half of the card-refund fix. Job Summary and the job window learned in the last release that a refund at Lowe’s or Home Depot comes off a job’s parts; now the numbers computed in the database agree: the Billing aging cost column, the Dashboard paid-profit chart, a partner’s job costing and profit share, a kept job baseline, and the parts total in the paid-job email.',
    'In the paid-job email’s cost timeline a refund shows as a card row with money coming back, the same way a supply-house credit memo already did.',
    'Nothing changes for jobs without a refund.',
  ],
}

export default note
