import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5482',
  date: '2026-10-13',
  title: 'Lien desk: a Deliveries filter under Sent, and an envelope that came back is a Do now row (Docsmit train, 6b, part 2)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Sent pile’s title has a Deliveries button when any notice went through Docsmit. Press it to see only those notices, each row saying where its envelopes are.',
    'An envelope that came back, went unclaimed, or that Docsmit refused is a red row under Needs you now on Do now. Its button opens the notice under Sent.',
    'Nothing changes for a notice printed and mailed by hand.',
  ],
}

export default note
