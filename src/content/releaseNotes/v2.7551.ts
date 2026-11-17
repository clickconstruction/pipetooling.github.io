import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7551',
  date: '2026-11-16',
  title: 'Checklist: yesterday\'s unticked task asks once, did it or skipped',
  kind: 'feature',
  highlights: [
    'A daily or weekly task that was not ticked now asks about it the next day, at the top of Today.',
    'Did it marks that day done, for work you did and forgot to tick. Skipped takes the task off the question.',
    'History shows a skipped day as Skipped, apart from a day nobody answered for.',
    'The question looks back three days, so Monday asks about Friday.',
  ],
}

export default note
