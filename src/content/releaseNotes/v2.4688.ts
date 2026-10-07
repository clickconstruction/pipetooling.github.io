import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4688',
  date: '2026-10-06',
  title: 'Submittals: one Next line on the page',
  kind: 'fix',
  highlights: [
    'On Bids → Submittals the strip at the top said Next: … and the procurement log said Next: … too. Both were right, and a page with two Nexts has none.',
    'The log’s line under its four steps keeps its sentences and loses the bold Next. The strip’s Next line is the one Next on the page.',
  ],
}

export default note
