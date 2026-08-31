import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2551',
  date: '2026-08-31',
  title: 'Late arrivals show up in the write-ups timeline',
  kind: 'feature',
  highlights: [
    'People → Writeups now weaves derived "◔ Late" rows between write-ups and NCNS records — computed from clock records, so there\'s nothing to file and nothing to clean up. A checkbox hides them when you want the discipline-only view.',
    'Narrow the Subject search to one person and an Attendance card sums their last 90 days: times late, median, NCNS count, and on-time days out of scheduled days.',
    'When someone has 3+ lates in 30 days, the card offers "Start a tardiness write-up" right there.',
  ],
}

export default note
