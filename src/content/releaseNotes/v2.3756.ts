import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3756',
  date: '2026-09-23',
  title: 'Where everyone is: the clocked-in map',
  kind: 'feature',
  highlights: [
    'A Map button in the Currently In bar — on the Dashboard, People → Hours and Quickfill — opens a map of everyone clocked in, placed by the job or bid they are on. One pin per job with the head count on it, jobs blue and bids violet; office sessions sit on the office diamond; a person with no job is named under the list with the Assign door, never guessed onto the map.',
    'The stops are listed beside the map, most people first, each with the address, the miles from the office, who is there and for how long. Tap a stop to select its pin, or a pin to see its people, then Open job (or Open bid) and Directions.',
    'Live from the strip’s own feed — it moves as people clock in and out and fetches nothing new. Google Maps when the browser key loads, OpenStreetMap otherwise. On a phone it is a full-screen sheet with the selected stop as a bar under the map and two big buttons.',
    'A job whose address has no map location yet is listed under the map with a link, the same line the jobs map uses.',
  ],
}

export default note
