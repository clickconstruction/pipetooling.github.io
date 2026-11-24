import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8510',
  date: '2026-11-24',
  title: 'Lien desk: one check recorded over every bill it pays',
  kind: 'feature',
  highlights: [
    'In Payoffs, a place with liens on record has a new press, One check for this place. Type what the check says once: its amount, its number and the day it came.',
    'The app places the check on the liened bills first, oldest first, and shows the check, what is placed and what is left. Any amount can be changed where it sits.',
    'One press records a payment on every bill that is ready. A part payment on a Stripe bill is held with its reason and a door to the bill.',
    'Payoffs also shows money open at the place on a job with no lien, so a release is never read as covering it.',
  ],
}

export default note
