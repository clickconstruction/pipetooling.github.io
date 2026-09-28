import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3946',
  date: '2026-09-27',
  title: 'My Time day editor: the reject confirm is its own piece',
  kind: 'fix',
  highlights: [
    'The “Reject clock session?” confirm was written inside the day editor. It is its own small piece now, with tests for what it says and what each button does.',
    'Nothing on screen changes.',
  ],
}

export default note
