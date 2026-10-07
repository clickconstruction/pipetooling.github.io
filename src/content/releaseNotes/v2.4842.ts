import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4834',
  date: '2026-10-07',
  title: 'GC mode: the billing rules move to the real app',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rules for billing a GC customer move from the GC mode prototype into the real app, word for word: the customer’s price by line, what each bill asks, what is paid and open, the retainage and when it drops, and the day a bill is due.',
    'Also moved: interest on a late bill, a reminder to pay, finishing past the contract’s day, and the words for a change order. Nothing on screen changes yet.',
  ],
}

export default note
