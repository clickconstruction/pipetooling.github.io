import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3416',
  date: '2026-09-14',
  title: 'Pipeline: the Progress & payment legend adds up',
  kind: 'fix',
  highlights: [
    'The amber row under the bar is now “Done, not billed” and prints the amber slice’s own dollars — finished work that is on no bill yet — instead of everything the customer has not paid for, which still counted the money already billed.',
    'A new “Not done” row names the empty part of the bar, so Paid + Billed + Done, not billed + Not done equal the bid.',
    'The phone card list reads the same way.',
  ],
}

export default note
