import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6377',
  date: '2026-11-02',
  title: 'The Development page on a phone: Plans as cards, the strip as one row, and a faster read',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a phone the Plans look draws each part of the site as a card: the set it builds from, dated and came on one line, the memo, the jobs on it and the older sets. The seven-column table ran past the screen’s edge; the page now ends at it.',
    'The strip of five looks is one row of five cells on a phone, each the look’s name over one figure, the look you are in underlined. It stood four ragged lines tall; it stands one.',
    'The page’s first read is four round trips deep instead of seven, and the Costs column’s card-charge read no longer carries the bank’s raw payloads. On a large site that read fell from 1.5 MB to 308 KB and the table draws about a second and a half sooner.',
    'The On record block under History wraps on a phone instead of running past the edge.',
  ],
}

export default note
