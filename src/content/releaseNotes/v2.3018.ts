import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3018',
  date: '2026-09-07',
  title: 'Safety net under job materials cost',
  kind: 'fix',
  highlights: [
    'The materials-cost figures on a job — supply invoices, card charges and tally parts — now have 4 tests pinning how each is read and priced and that one source failing never blanks the others; no behaviour change.',
  ],
}

export default note
