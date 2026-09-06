import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2906',
  date: '2026-09-05',
  title: 'The supply-house quote page keeps typed prices in reach',
  kind: 'fix',
  highlights: [
    'When a vendor taps Send quote and the signal drops, the page no longer replaces their work with a single sentence — the form stays put, the notice sits next to the button, and the button reads "Try again".',
    'If the request was closed while the vendor was typing (or they open a closed link later), the closed screen now lists what they typed — "Your typed prices stayed on this phone — nothing was sent" — instead of hiding it.',
    'The sticky footer now counts freight and the good-until date alongside the lines ("Freight $45.00 · good until 2026-10-03", or "No freight quoted · no expiry date"), and carries the save promise — "Saves on this phone as you go" — where the thumb is, instead of buried in the intro paragraph.',
    'A dead or closed link no longer leaves a stray draft on the vendor\'s phone; a failed load offers a Reload button; and each price box says what it asks for — "$ each" or "$ per ft".',
  ],
}

export default note
