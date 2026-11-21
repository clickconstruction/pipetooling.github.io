import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8214',
  date: '2026-11-21',
  title: 'The estimator’s word on money: the last untyped calls are checked',
  kind: 'infra',
  highlights: [
    'Nothing on a screen changes. The money line under a won bid, the Money lens, the Dashboard card, the word from a customer’s line in Messages and Write down their word read and write as before.',
    'The app’s calls behind them are now checked against the database’s own list of functions, so a misspelled name or a wrong argument stops a change before it ships.',
    'When someone writes down that a customer says they paid and leaves the amount, the name or the note empty, the app now leaves those off the call. The record reads the same as before.',
  ],
}

export default note
