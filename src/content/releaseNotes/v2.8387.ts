import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8387',
  date: '2026-11-23',
  title: 'People → HR: a link to one person opens their file',
  kind: 'fix',
  highlights: [
    'A link to one person’s HR file opens that file. It used to open the whole list and lose the person.',
    'The address names the person while their file is open, and a press on a name in the list updates it, so the link can be copied and sent.',
    'A link that matches no one you can see opens the list with one line that says so.',
  ],
}

export default note
