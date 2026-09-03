import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2685',
  date: '2026-09-03',
  title: 'Contract sweep — clear the jobs that have no agreement on file',
  kind: 'feature',
  highlights: [
    'The Dashboard’s Needs You list now counts live jobs with no contract on file (and how much work is running on a handshake), plus contracts out for signature a week without an answer.',
    'Start the sweep from that card or from the Pipeline’s ⋯ menu: every job is one row with the customer’s email and a Send button — Send all takes every row that has an email, Fix email opens the job for the rest.',
    'Each send uses the job’s own scope and amount with the terms you pick once for the whole sweep; open any row for careful edits or to upload a signed paper copy instead.',
  ],
}

export default note
