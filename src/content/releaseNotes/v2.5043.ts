import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5043',
  date: '2026-10-09',
  title: 'Bids and jobs: the margin a bid was priced at, beside the job’s burn',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Pricing: each price you save keeps the Workbench’s margin on the bid, with our cost and the price behind it. Once the bid is sent it reads “Went out at” that margin, and repricing does not move it.',
    'A job’s Costs tab: under the margin at completion, a line says what the bid was priced at and how many points the job runs under or over it.',
    'Bids → Bid Costs → Bid vs actual has a Priced column beside the read, or “not priced on the Workbench”.',
    'A margin saved with no labor rate, or with rows that have no cost, says it reads high.',
  ],
}

export default note
