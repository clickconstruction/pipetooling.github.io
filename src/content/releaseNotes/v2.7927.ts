import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7927',
  date: '2026-11-19',
  title: 'The Bid Board’s search keeps its room, and its row of buttons is one height',
  kind: 'fix',
  highlights: [
    'The search box and every button beside it are now the same height. Rate a GC after a job drew taller than its neighbours, and the icons under it on a phone drew shorter.',
    'On a small laptop or a tablet the search box had shrunk to a sliver and the page slid sideways. Pricing rules, Reply book and Customer review now become their icons when the row is tight, and the buttons take a second line before anything leaves the screen. Hover an icon to read its name.',
    'Rate a GC after a job now sits in front of Marked. On a phone it shares the line with the development filter, so the row is three lines where it was four.',
    'On a wide screen with nothing to rate, the row reads as before, with Customer review now showing its icon beside its name.',
  ],
}

export default note
