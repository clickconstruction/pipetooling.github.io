import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6079',
  date: '2026-10-29',
  title: 'The morning run keeps back a reminder with a blank it cannot fill',
  kind: 'fix',
  highlights: [
    'A reminder the app sends itself now waits when its step’s line still has a blank the app cannot fill, like {amount} or {bill}. Before, the text went with the braces in it. The morning summary says how many waited and why.',
    'On Offers the prepared text is held on Today’s sends with why and its door: send it from the customer’s thread, where the box fills the blank, or change the step’s line.',
    'The app now fills {link}, their page’s link, in a reminder it sends or prepares.',
    'A line the app can fill in full goes as before, and the review ask’s link is still made as the text goes.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
