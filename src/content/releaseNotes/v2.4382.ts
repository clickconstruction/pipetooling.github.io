import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4382',
  date: '2026-10-02',
  title: 'Procurement log: one calm line per part',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'Each line shows the maker and model first, then its house, stage and lead time in their own columns.',
    'One Status replaces seven date columns, like Order by 10/06 or On site 09/29. Tap it to type the order date, PO, dates and a note.',
    'Under each tag the GC’s parts come first and the order-only parts follow in grey. The heading says the fixture, how many and how far along, and flags two carriers.',
    'A draft says once that nothing is released yet, instead of Not shared on every line. Tap a house to change it.',
  ],
}

export default note
