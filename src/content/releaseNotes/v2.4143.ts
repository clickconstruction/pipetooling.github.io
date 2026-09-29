import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4143',
  date: '2026-09-29',
  title: 'Submittals: Assign pages — walk the vendor PDF, one page at a time, the answer pre-filled',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'Assign pages… on a dropped vendor PDF opens a full-screen walk: each page at reading size on the left, the fixture rows in schedule order on the right, and every page of the file as a colored strip along the bottom.',
    'The app reads each page and lights the row whose model number is on it — “Looks like WHA-500 · its model number is on the page”. Space says yes and moves on; a page that names nothing continues the row before it. Enter or a click puts the page on a row, X marks a page that is not a cut sheet, Backspace undoes, and typing a tag or model finds a row.',
    'Every page is reviewed because the package goes to the customer: the Done button counts “23 of 75 seen” and unlocks only when every page is on a row or marked not a cut sheet. Nothing is written until Done; Cancel leaves the rows as they were.',
    'A row with no page yet offers “find its pages” — the pages whose text names its model — and one click jumps the walk there. The one-tap-per-page strip and the typed page range on Edit still work.',
  ],
}

export default note
