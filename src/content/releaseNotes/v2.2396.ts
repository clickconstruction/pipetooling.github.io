import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2396',
  date: '2026-08-27',
  title: 'Workbench: $0 reads as unpriced, and the price book stops wandering',
  kind: 'fix',
  highlights: [
    'A row saved at $0 now shows the — dash and counts as unpriced — so "Show unpriced only", the priced meter, and the solver\'s "Price unpriced only" all find them.',
    'In the price book drawer, clicking a book just looks inside it — switching the bid to that book is now an explicit "Use … on this bid" button, so browsing never mints another price version.',
    'Switching back to a book you already use finds your existing copy again (it used to create a fresh one each time), and the Old view\'s price-book dropdown no longer shows "Select a price book…" for prices born from a version copy.',
  ],
}

export default note
