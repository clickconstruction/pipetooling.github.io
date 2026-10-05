import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4534',
  date: '2026-10-05',
  title: 'Old payments no longer pay off newer bills',
  kind: 'fix',
  highlights: [
    'A payment recorded on a job with no bill attached now pays the part of the job that is on no bill first. Only what is left goes to the bills, oldest first.',
    'Before, money received before a bill existed could be counted against it. On three jobs, $28,028.58 of open bills read as paid.',
    'The demand letter on job 273 claimed $0 beside a lien notice for $17,585. It now claims the three open bills.',
    'The Bill tab, the payment history printed on an invoice and the customer portal follow the same rule, so they agree with the job’s open balance.',
  ],
}

export default note
