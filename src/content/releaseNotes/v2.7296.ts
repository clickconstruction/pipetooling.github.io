import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7296',
  date: '2026-11-15',
  title: 'GC difficulty rating, part 3: the Paying scale is read from the bills',
  kind: 'feature',
  highlights: [
    'On the card How they are to work with, Paying is no longer picked: the app reads it from the GC’s bills. Under the scale it says what it found, such as paid in 52 days over 7 bills, the GC pace here, and how many bills in the last year went past their pay calendar. A point when the median is past 45 days or two bills in a year are late; fewer than three bills reads no point and says so.',
    'The point goes into the rating with its words when you save, so the rating stays a record with reasons. When the bills later read a different point, an amber line says so and Save wakes.',
    'The office can set the Paying point by hand with a reason, and take it back to the bills with one press.',
    'From the live walk of part 2: Rate them shows on the opened row only, and the chip beside the GC’s name shows on every bid row and on the Workbench of a bid with nothing to price yet.',
  ],
}

export default note
