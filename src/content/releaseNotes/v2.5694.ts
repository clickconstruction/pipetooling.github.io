import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5694',
  date: '2026-10-20',
  title: 'Supply Houses: an aging cell’s bills sit under their job, with its job account in words',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'Pressing an aging cell now opens with the answer: how much of it is on job accounts (the owners’ debt) and how much is not (Click’s), with a bar and a line on how the jobs stand at the house.',
    'Bills sit under their job. Each job’s heading says its job account in words — open with its reference, asked for, not needed, or none at the house yet — and holds Mark opened… where one is missing.',
    'A job with an open account offers Mark it on per bill, and Flag anyway… unfolds the same press where none is on record; a flagged bill reads On it ✓ and one press takes it off. Split bills, bills with no job and credit memos get their own groups.',
    'Each bill fits on one line on the desk and two on a phone, and the footer no longer lets rows show through beneath it.',
  ],
}

export default note
