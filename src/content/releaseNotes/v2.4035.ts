import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4035',
  date: '2026-09-28',
  title: 'My Time day editor: the salary sync note shows whenever salaried time is re-cut',
  kind: 'fix',
  highlights: [
    'After you change the times of a salaried person’s scheduled session, the day editor says the next salary sync may adjust those rows. It only said so for some kinds of change.',
    'Now it says so after any split, moved line, merge or rebuild of a block holding salaried time — and not after a notes-only change.',
  ],
}

export default note
