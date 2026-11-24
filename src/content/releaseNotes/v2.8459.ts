import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8459',
  date: '2026-11-24',
  title: 'View as: the server refuses the seen marks too',
  kind: 'fix',
  highlights: [
    'The server now refuses to mark things as seen from a session a dev opened through View as or Imitate.',
    'That covers an answer to a note you tagged someone in, on a job or a task, a bid marked for you, and a law firm’s answers.',
    'Before, only the app held these back, so a browser on an older build could still clear them.',
    'A press made in View as, such as Done on a bid request, still saves. A person’s own sign-in is never held.',
  ],
}

export default note
