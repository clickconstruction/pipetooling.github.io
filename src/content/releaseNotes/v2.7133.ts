import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7133',
  date: '2026-11-13',
  title: 'Bid photos: a photo whose first send was cut off now lands on the next try',
  kind: 'fix',
  highlights: [
    'A bid photo sent on a weak signal could reach the office while the phone never heard back. The phone then tried again and was turned away every time, so the photo waited until the next morning and never landed.',
    'The next try now finds the photo already there and finishes adding it to the bid.',
  ],
}

export default note
