import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1937',
  date: '2026-08-20',
  title: 'Goal cards on Checklist Review stay one line',
  kind: 'fix',
  highlights: [
    'A goal with many current stages now shows the first three and folds the rest into "… +N more", instead of wrapping its card to several lines.',
  ],
}

export default note
