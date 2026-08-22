import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2081',
  date: '2026-08-22',
  kind: 'feature',
  title: 'Bid tab capture: high, low, and where we landed',
  highlights: [
    'When a GC shares the bid tab, record it in the words of the call: low bid, high bid, and "we were #2 from the bottom, of 6" — money fields take shorthand like 230k.',
    'The math happens for you: as you type, a live line shows how far over the low we were, flags "we were the low bid — price wasn\'t the reason," and catches numbers that don\'t add up.',
    'Capture lives at the two moments you have the tab in hand: the "Bid tab received" tap on Waiting to hear (numbers optional — one tap still just logs the touch) and every lost-bid card on Why we lost.',
    'Recorded tabs show as one line with a low-to-high strip on the bid card — the raw material for comparing losses and sharpening future bids.',
  ],
}

export default note
