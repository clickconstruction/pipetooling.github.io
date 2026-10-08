import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4908',
  date: '2026-10-07',
  title: 'My Time day editor: the time strip’s drag and tap code moved to its own file',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the code behind dragging, tapping and arrow keys on the time strip moved to its own file.',
    'Nothing changes on screen. A tap adds a split, a drag moves it and the arrow keys nudge it, exactly as before.',
    'New tests cover each of those, plus the cancel and the switch between Visual and Form. They found that the arrow keys cannot move a split that sits where two clock rows meet. That fix comes separately.',
  ],
}

export default note
