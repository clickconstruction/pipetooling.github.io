import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8074',
  date: '2026-11-20',
  title: 'Lien desk on a phone: who noted a closed month stays inside its row',
  kind: 'fix',
  highlights: [
    'On a phone, a closed month says who noted it and when. With a full name that line ran into the tick at the right.',
    'The line now wraps inside the month’s own column. On a computer it is one line, as before.',
  ],
}

export default note
