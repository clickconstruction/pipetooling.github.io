import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4925',
  date: '2026-10-08',
  title: 'GC mode: a trade partner’s portal can take what the company sends',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A new function takes what a trade partner sends from its portal: a quote, the day its quote will come, a pass, a question about the plans, and who gets its emails.',
    'Each one acts only on the company the link belongs to, and a company can send ten written things an hour.',
    'Every refusal has its own words in the company’s language. The portal’s buttons come next.',
  ],
}

export default note
