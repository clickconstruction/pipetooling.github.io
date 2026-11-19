import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7965',
  date: '2026-11-19',
  title: 'My Inbox: Forward on an overdue task is the office’s, as it is on a task due today',
  kind: 'fix',
  highlights: [
    'The forward arrow on an overdue task in My Inbox now shows for the office only. It showed for everyone, while Forward on a task due today was already the office’s.',
    'Nothing changes for the office. Forward still hands on the same task with its notes, place and photos, and tells whoever takes it.',
    'Anyone else hands on their own task with Hand it on, under More on the task in the Checklist. That press lets them say why, and tells whoever gave the task.',
  ],
}

export default note
