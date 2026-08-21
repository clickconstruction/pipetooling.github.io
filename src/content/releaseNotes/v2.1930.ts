import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1930',
  date: '2026-08-20',
  title: 'Payment forecast shows pay speeds by customer type',
  kind: 'feature',
  highlights: [
    'A new Pay speeds strip in the Payment forecast: the company-wide average pay time alongside the residential and commercial averages, each with its payment count.',
    'Every forecast row now wears the customer\'s Res/Comm tag, so a slow commercial payer reads differently from a slow residential one at a glance.',
  ],
}

export default note
