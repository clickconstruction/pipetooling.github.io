import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4557',
  date: '2026-10-05',
  title: 'Documents: every bill email is kept as it went',
  kind: 'feature',
  highlights: [
    'When a bill is emailed, the email and its PDF are now kept. Find them on the job’s Documents tab under Sent from this job.',
    'This covers a bill sent with its PDF attached, a Stripe bill, and each copy that goes to the people on the copy list.',
    'Emailing a bill again now leaves its own line. Before, a second send left no trace on the job.',
    'A test bill goes only to you, so it is not kept as a send.',
  ],
}

export default note
