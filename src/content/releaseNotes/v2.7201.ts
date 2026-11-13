import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7201',
  date: '2026-11-13',
  title: 'Pay calendar: an estimator writes down the pay terms on a won bid, and the office sets them',
  kind: 'feature',
  highlights: [
    'An estimator’s Send to Dispatch sheet has one new small line under the GC, Add their pay terms. Press it to pick the cutoff, the pay day and whether the terms are for this job or every job the GC pays.',
    'New Job opened from that draft shows the terms above the customer with Check and use. The pay calendar opens filled in, with the payer’s record against it. Terms for the job alone are saved when the job is created.',
    'Skipped in New Job, the terms stay on the job’s Pay calendar row until the office uses them.',
    'When the job is already open, the estimator’s won bid offers Send their pay terms to the office. Dispatch gets a row with Open the pay calendar and Not a calendar payer.',
  ],
}

export default note
