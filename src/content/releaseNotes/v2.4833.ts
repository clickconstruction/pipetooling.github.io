import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4833',
  date: '2026-10-08',
  title: 'GC mode: the record for each trade partner company',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'GC mode gets one record for each trade partner company. It holds the main contact and the others it names, the emails each gets, where it drives from and how far, and its language. It also holds whether we have vetted it.',
    'The record keeps each company we ask to quote and its quotes. It keeps the call log and the days a company promised us something.',
    'Only a dev can see it while it is built, and nothing on screen uses it yet.',
  ],
}

export default note
