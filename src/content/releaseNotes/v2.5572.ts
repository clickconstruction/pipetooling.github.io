import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5572',
  date: '2026-10-16',
  title: 'Messages: a new text shows without reloading',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When someone texts back, their line now appears in the open thread, in Follow up and on the Messages count in the header within a second or two. Until now the page had to be closed and reopened to see it.',
    'The same goes for a call, a voicemail, a delivery mark and a teammate taking or handing on a conversation on another computer.',
  ],
}

export default note
