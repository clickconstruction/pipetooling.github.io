import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2646',
  date: '2026-09-02',
  title: 'Vendor quote page: last time\'s prices, one tap away',
  kind: 'feature',
  highlights: [
    'When a supply house opens a quote link for parts they\'ve priced before, the page offers "Fill with last time\'s prices" — one tap, then they just change what moved. A repeat quote takes about ninety seconds.',
    'Filled prices wear a "from last time" tag until touched, only their own history is ever shown, and nothing fills without the vendor\'s deliberate tap.',
  ],
}

export default note
