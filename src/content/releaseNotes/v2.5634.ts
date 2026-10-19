import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5634',
  date: '2026-10-19',
  title: 'Every Stripe bill email, resends too, shows in the job’s trail',
  kind: 'fix',
  highlights: [
    'Pressing Resend on a bill’s Stripe line now adds a “Bill emailed through Stripe” line to the Pipeline row’s activity and the job’s trail, the moment it goes.',
    'Until now only a bill’s first send was kept as a line. Resends already made since June get their lines too.',
  ],
}

export default note
