import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4436',
  date: '2026-10-02',
  title: 'Submittals: buy a fixture without sending it to the GC',
  kind: 'feature',
  highlights: [
    'On a draft, the × on a row now asks whether you still buy the fixture. Order only keeps it on the procurement log and off the GC’s submittal. Left out takes it off both.',
    'Order-only fixtures sit in their own group under the rows. They need no status, reason or cut sheet, and Put on the submittal brings one back.',
    'On the procurement log an order-only fixture reads Ready to order right away. It does not wait on the GC, and the GC’s copy leaves it out.',
    'A fixture you have already ordered cannot be left out by accident. The window says when it was ordered.',
  ],
}

export default note
