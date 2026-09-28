import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4051',
  date: '2026-09-28',
  title: 'Pipeline: does the money land before the lien dies? The lien runway under every billed row',
  kind: 'feature',
  highlights: [
    'Every Billed and Collections row now carries a short runway under its money bar: today at the left, a green dot where the customer is expected to pay, and a flag on the last day a lien affidavit can be filed. Green between them means room; red hatching means the lien dies before the money lands.',
    'One sentence under the track says it in words — "pay Oct 3 → lien Oct 15 · 12 d of room", "lien Nov 16 → pay Nov 20 · file first", "no pay date · lien Oct 15 · 17 d", or "lien gone · window closed Sep 15" — and opens the job\'s Lien window, where the basis is spelled out.',
    'A house whose property kind is not set is read on the residential clock, the earlier date, and the hover says so. Set the kind on the property record to confirm it.',
    'On a phone the row\'s one chip carries the verdict — "file first", "lien gone", "lien in 17 d", "12 d of room" — once the flag is inside three weeks or the money is due after it.',
  ],
}

export default note
