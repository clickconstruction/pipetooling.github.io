import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3919',
  date: '2026-09-27',
  title: 'My Time day editor: two confirm windows are their own pieces',
  kind: 'fix',
  highlights: [
    'The “Not coming in” button and its confirm, and the “Discard unsaved changes?” confirm, were written inside the day editor. Each is its own small piece now, with tests for what they say and what each button does.',
    'Nothing on screen changes.',
  ],
}

export default note
