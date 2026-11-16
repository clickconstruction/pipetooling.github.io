import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7512',
  date: '2026-11-16',
  title: 'Lien desk: Just this one prints every envelope’s set, signed, as the run prints it',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Just this one on an approved notice printed one set of pages behind a sheet that said to photocopy it for the second envelope and to sign each set in ink. The desk already held the leader’s signature and counsel’s letter, and that print carried neither.',
    'The link now opens the run on that one notice. One press prints the checklist, a divider page before each envelope, and each envelope’s own set with the signature and the cover letter. Nothing is photocopied.',
    'The link says what will print, like Just this one · 2 envelopes. An envelope with no mailing address is counted as held, and a notice nobody has signed reads held, with the reason when you rest the pointer on it.',
    'The mail numbers are typed in the same window, so one notice sent alone is recorded the same way as one sent with the rest.',
  ],
}

export default note
