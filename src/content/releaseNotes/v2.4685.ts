import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4685',
  date: '2026-10-06',
  title: 'Submittals: a supply house has a usual lead time, so the log gets its dates without typing one on every part',
  kind: 'feature',
  highlights: [
    'A supply house now has a Usual lead time, on its form under Materials. Type it once, like 3 wk.',
    'On Bids → Submittals, a part with no lead time of its own reads its house’s usual one on the procurement log. Order-by dates, the day the GC must answer by and the calendar appear from it. A number typed on the part still wins.',
    'In a row’s Edit window the empty lead-time box shows the usual as a hint, like 3 wk · National Wholesale’s usual, and no longer reads as missing.',
  ],
}

export default note
