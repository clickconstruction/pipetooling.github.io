import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8504',
  date: '2026-11-24',
  title: 'Lien desk: Payoffs, what to do when someone pays off a lien',
  kind: 'feature',
  highlights: [
    'The Lien desk has a new line over its lists, Payoffs. It says how many filed liens are paid and still on record, with one press: Someone paid.',
    'The press opens every filed lien under its place. The place says how much pays its liens off.',
    'Each lien says where it stands in one sentence and offers the one press that comes next: record the payment, make the release, then record it at the county.',
    'A lien on a job paid to zero used to leave the desk with its lien still on record. It now stays in Payoffs until its release is recorded.',
  ],
}

export default note
