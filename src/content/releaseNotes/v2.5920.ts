import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5920',
  date: '2026-10-26',
  title: 'Legal desk: answer a gap, not only fix it',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Every row under Before this goes to an attorney gains Answer…: one line the attorney reads beside the gap, with an Evidence document that shows it. Work done on a handshake stops reading as an unexplained hole.',
    'An answered note moves to an Answered group and leaves the to-know-about count; a red gap stays red with its answer riding under it. Edit or Clear an answer any time.',
    'A job already marked contract not needed answers its own agreement gap automatically — nothing retyped, the line reads straight from the job’s contract strip.',
  ],
}

export default note
