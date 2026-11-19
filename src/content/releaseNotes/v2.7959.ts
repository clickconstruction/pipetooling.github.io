import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7959',
  date: '2026-11-19',
  title: 'Who owes what: Email again reaches the GC on a paper bill that went to the GC',
  kind: 'fix',
  highlights: [
    'Email again on a paper bill that went to the GC sends to the GC\'s billing email. It sent to the job\'s customer, and the send was refused.',
    'The window names that address before you press Send email.',
    'A GC job with no customer now shows Email again. It was missing there.',
    'A GC with no billing email on record gets the reason and where to add it, and no send.',
  ],
}

export default note
