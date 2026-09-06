import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2901',
  date: '2026-09-05',
  title: 'A bid visit reads as a bid visit everywhere on the schedule',
  kind: 'fix',
  highlights: [
    'The Day tab names a scheduled bid ("Bid visit · B408 · Oakmont Clubhouse") instead of the "— · Job" placeholder — the same identity the Clocked line under it already showed.',
    'Jobs that only have a click number now print it ("J1042 · Water Heater removal") on the Day tab, in the add-block picker, and in a person\'s day, week, and month schedule — no more "— · name" two tabs apart from "J1042 · name".',
    'Bid blocks on the week grid are tinted violet with a small "bid" chip so they never look like just another job card; clicking the title or the time opens the bid.',
    'The Jobs tab\'s commitment matrix lists bid visits under the job rows, with the same per-day counts and an Open button that goes to the bid.',
  ],
}

export default note
