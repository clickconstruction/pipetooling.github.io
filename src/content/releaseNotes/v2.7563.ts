import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7563',
  date: '2026-11-17',
  title: 'Forward hands on the same task from My Inbox, and tells who takes it',
  kind: 'fix',
  highlights: [
    'Forward on My Inbox now gives the same task to the person you pick. It keeps its notes, place and photos.',
    'It used to make a copy and throw the first task away. Forward on the Checklist was fixed first, and this is the last one.',
    'The person who takes a forwarded task now gets a message on their phone. This is true on My Inbox and on the Checklist.',
    'The window shows the task as it is and no longer asks for a new title. If a task cannot be forwarded, it says why.',
  ],
}

export default note
