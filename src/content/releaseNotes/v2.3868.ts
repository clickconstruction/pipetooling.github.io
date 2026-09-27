import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3868',
  date: '2026-09-26',
  title: 'Estimates: what a list row says has tests',
  kind: 'fix',
  highlights: [
    'The words on an estimate list row — the customer line under the title, the two-line customer column on the Pipeline, the money, the status, the “· 3 options · 1 add-on” tell, the Declined chip, the linked job number — and the search the list filters on all lived inside the Estimates page with no test. They now live in one small module with ten.',
    'Nothing on screen changes; every row reads as before.',
  ],
}

export default note
