import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8653',
  date: '2026-11-26',
  title: 'Dashboard on a phone: the folded Recent reports line says what it counts',
  kind: 'fix',
  highlights: [
    'Folded, Recent reports read 15 new · 15 listed. Opened, the card lists eight reports at a time. The word listed was wrong.',
    'The folded line now reads 15 new of 15. With nothing new it reads 15 reports · all read.',
    'The numbers are the same as before. Only the words changed.',
  ],
}

export default note
