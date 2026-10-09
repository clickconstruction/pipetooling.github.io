import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5099',
  date: '2026-10-09',
  title: 'GC Review: emailing a statement goes through one tested piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, Send statement in GC Review now hands the email to one small piece instead of the Pipeline board doing it itself.',
    'Nothing changes on screen. The board still says who the statement went to and updates its last sent dates.',
    'New tests cover what the email carries, the words shown when a send is refused, and the board’s side of a send.',
  ],
}

export default note
