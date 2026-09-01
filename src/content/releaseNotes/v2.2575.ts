import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2575',
  date: '2026-09-01',
  title: 'Supply house edit form fits on smaller screens',
  kind: 'fix',
  highlights: [
    'The Add / Edit Supply House window could grow taller than the screen, hiding the Update button with no way to scroll to it. The window now scrolls, so the buttons are always reachable.',
  ],
}

export default note
