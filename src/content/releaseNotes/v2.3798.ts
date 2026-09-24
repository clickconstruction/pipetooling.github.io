import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3798',
  date: '2026-09-24',
  title: 'Hiring: a column can be shared with an assistant (the rules, before the switch)',
  kind: 'feature',
  highlights: [
    'A Hiring column can now be shared with someone who has Prospects access but not the Hiring board — the assistant who feeds helpers to the masters. The database knows the rule from today; the Share with… control and the assistant’s trimmed tab follow in the next two releases.',
    'Someone a column is shared with will see only that column’s cards on Screen, Interview and Try-out, may add, edit, rank, mark Talked today, Advance and press Try out inside it, and can never Hire, Pass, Keep trying, move a card to another column, delete anything, or see Hire, Review or another column.',
    'Nothing changes for anyone who holds the Hiring board today.',
  ],
}

export default note
