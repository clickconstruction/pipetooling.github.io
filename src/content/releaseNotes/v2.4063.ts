import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4063',
  date: '2026-09-28',
  title: 'My Time day editor: the database can now save a whole day at once',
  kind: 'fix',
  highlights: [
    'Groundwork for an all-or-nothing Save in the day editor: the database now has one step that applies every change to a day together, and undoes all of them if any one fails.',
    'Nothing uses it yet, so nothing changes on screen; the editor switches to it in the next update.',
  ],
}

export default note
