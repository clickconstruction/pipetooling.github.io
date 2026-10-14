import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5532',
  date: '2026-10-14',
  title: 'Lien desk: a mailing through Docsmit is kept the moment it goes',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Closing the run before Record the run no longer loses a mailing through Docsmit. A notice whose copies all went moves to In the mail at once.',
    'The next run shows those envelopes as mailed through Docsmit. It never offers to mail them again, and the packet leaves them out.',
    'A notice that went part by Docsmit and part on paper moves to In the mail once its paper copy prints. Take back no longer offers a notice Docsmit mailed.',
    'When Docsmit stops part way, as on short credit, the run says which envelopes went. An address Docsmit will not mail shows its reason.',
  ],
}

export default note
