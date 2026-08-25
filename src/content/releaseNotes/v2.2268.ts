import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2268',
  date: '2026-08-25',
  title: 'Coming up untangles from Outstanding',
  kind: 'fix',
  highlights: [
    'The ⏳ Coming up list was rendering inside the first Outstanding card on Checklist → Today, making one overdue task look like a wall of ten and stranding its checkbox mid-list.',
    'It now sits in its own section below Outstanding, so the red "needs doing" card is back to just the task, its checkbox, and its due date.',
  ],
}

export default note
