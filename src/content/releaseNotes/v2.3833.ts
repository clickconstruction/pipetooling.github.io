import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3833',
  date: '2026-09-25',
  title: 'Bids: “Edit bid” on the Lien Release tab opens that bid’s own details',
  kind: 'fix',
  highlights: [
    'The Edit bid button on Bids → Lien Release opened the Bid window without loading the bid into it, so the fields could show the last bid you had open — or a blank New Bid form — under this bid’s name. Since the window saves as you type, an edit there could write those stale values onto the bid.',
    'It now opens exactly like Edit everywhere else on Bids: the bid’s own fields, its sent date, on the Edit tab.',
  ],
}

export default note
