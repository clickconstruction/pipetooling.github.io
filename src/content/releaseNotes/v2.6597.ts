import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6597',
  date: '2026-11-06',
  title: 'The ring: a task card says how far along it is instead of done or not',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'estimator', 'subcontractor', 'helpers', 'superintendent'],
  highlights: [
    'On Checklist → Today, its Outstanding list and the Dashboard’s My Inbox, a one-off card and a roadmap card show a ring where the tick box was. Empty while nothing has moved, it fills to the percent, and reads a green ✓ once done. A card that repeats keeps its box.',
    'A tap on the ring opens Where does it stand?: pick 25, 50 or 75, type what is left if you like, and Set. The card’s thread keeps each move as Mateo · 75% · 2:05 PM with the words.',
    'The same sheet carries one green Done, so finishing stays two taps and takes the tick’s own path: the completion notice, the Review queue, the next repeat. A tap on a green ring reopens the card.',
    'A card with Done when… lines reads its ring from the ticks (2 of 3 is 67); the sheet says so and offers Done alone.',
  ],
}

export default note
