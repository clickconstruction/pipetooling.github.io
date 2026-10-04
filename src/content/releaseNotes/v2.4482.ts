import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4482',
  date: '2026-10-03',
  title: 'Submittals: the GC’s page asks in the GC’s words',
  kind: 'fix',
  highlights: [
    'A row built from the takeoff no longer tells the GC that the plans’ schedule was not on the bid. It reads: This is the product we intend to install.',
    'The headline reads 9 products need your answer. It used to read 9 rows need a call.',
    'A takeoff row’s card reads For your review and We intend to install. It no longer shows our own fixture name as The plans.',
    'A part count reads 2 to answer where it read 2 to go.',
  ],
}

export default note
