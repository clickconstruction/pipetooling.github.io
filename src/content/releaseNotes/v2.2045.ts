import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2045',
  date: '2026-08-21',
  kind: 'feature',
  title: 'One button turns any bill into a Stripe bill',
  highlights: [
    'Billed lines recorded outside Stripe (HouseCall Pro, paper) get a ⚡ Make Stripe bill button on Edit Job → Bill — one click adds the hosted pay page and card payment.',
    'The original billed date never moves: AR aging, Pipeline, and statements stay put, and the Stripe invoice number + memo carry the real date.',
    'Nothing is emailed by converting, and the customer portal swaps that bill to Pay online automatically.',
  ],
}

export default note
