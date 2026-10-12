import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5368',
  date: '2026-10-12',
  title: 'Lien desk: the leader confirms a pen signature from his own sign-in (pen train, PR 3)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When the office records a pen signature, the leader’s phone gets one line, and his desk lists the notice first under Signed by pen, as recorded.',
    'On the notice he presses Yes, I signed it, and the record carries his word too. Nothing waits on it. Not what I signed clears the signature; the approval stands and the run holds the notice until it is signed again.',
    'The chip on a ready notice reads signed by pen with the day and who wrote it down, and confirmed once he has.',
  ],
}

export default note
