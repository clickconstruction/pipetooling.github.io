import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5143',
  date: '2026-10-10',
  title: 'GC mode: keep a trade’s punch list, for a dev',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A job we are building has a Punch list window. Each trade we hired has a list of what is left to fix.',
    'Add an item with where it is and a photo link. Record that the trade says it is fixed, then check it or send it back.',
    'An item added by mistake can be taken off, and it stays in the record. The same lists sit under each trade on Closeout.',
    'The daily log no longer saves a cleared temperature as 0. Save waits until it has one.',
  ],
}

export default note
