import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8638',
  date: '2026-11-26',
  title: 'A screen reader now says the app’s notes: Saved, a refusal, a failure',
  kind: 'fix',
  highlights: [
    'The small note that slides in after a press, such as Saved or a reason something was refused, was drawn and never spoken. A person on a screen reader heard nothing.',
    'Each note’s words now carry a role a screen reader says. A failure or a warning is said at once. A done or a plain note waits its turn.',
    'Nothing on the screen looks different, and the note’s Undo and × are as they were.',
  ],
}

export default note
