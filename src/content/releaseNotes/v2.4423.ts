import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4423',
  date: '2026-10-02',
  title: 'Lien instruments on a phone: Already sent opens as its own page, and Release of record fits the screen',
  kind: 'fix',
  highlights: [
    'On a phone, Already sent — record it… was a box whose fields cut off their own words. The second “who it went to” tick ran off the edge.',
    'It now opens as its own page, like the other record steps. Every box is full width, and each tick is a whole row you can tap.',
    'Release of record has no step to open, so it stays in its tab. Its date, its saved copy and its buttons now fit a phone.',
    'A computer keeps what it had. The Lien desk’s own Already sent box is unchanged.',
  ],
}

export default note
