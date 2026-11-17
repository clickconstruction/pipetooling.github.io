import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7563',
  date: '2026-11-17',
  title: 'My Inbox: Forward hands on the same task, with its notes',
  kind: 'fix',
  highlights: [
    'Forward on My Inbox now gives the same task to the person you pick. It keeps its notes, place and photos.',
    'It used to make a copy and throw the first task away. Forward on the Checklist was fixed first, and this is the last one.',
    'The window shows the task as it is and no longer asks for a new title. The button names who takes it.',
    'If a task cannot be forwarded, the window says why. A roadmap task is handed on from the Roadmap.',
  ],
}

export default note
