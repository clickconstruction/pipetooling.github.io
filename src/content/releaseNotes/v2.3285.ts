import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3285',
  date: '2026-09-11',
  title: 'Payment terms on the customer, and they follow the customer onto New Bid and New Job',
  kind: 'feature',
  highlights: [
    'Each customer now carries payment terms — Standard, Deposit required, No new work past an unpaid promise, or Winding down — plus a note. Set them on Edit customer or from Customer review\'s new "set terms…" link.',
    'New Bid and New Job show a bar for the customer you pick: amber for deposit-required or a promise broken right now, red for winding down or no-new-work with a broken promise, always with the note and their record ("keeps 1 of 5 · slips ~23d · 2 bills open past promise"). A "Terms" button opens the terms right there.',
    'Customer review gains three columns — Pays in, Their word, Terms — so the customers whose word is worth planning around rank themselves.',
    'The demand letter\'s notice history now lists every date the customer promised, in their words: "Payment promised by Sep 12 — by the customer, in writing, from their statement page".',
  ],
}

export default note
