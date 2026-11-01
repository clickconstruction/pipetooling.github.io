import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6267',
  date: '2026-11-01',
  title: 'Every health line ends in the press, or says there is none',
  kind: 'feature',
  highlights: [
    'The line at the top of every screen now says what the app does by itself and what you press. Under “The app is slow right now.” it reads “It goes the moment a read lands. Nothing to press.” Under “Could not reach the app.” it reads “Check your signal, then press Retry to open the page again.” Under “No signal.” it reads “Clock presses, notes and reports wait on the phone and go out when the signal is back.”',
    'The Dashboard’s The office’s round card no longer says the stations wait on Quickfill. The morning after a missed round, and before today’s round starts, it names the station today’s round starts on, the one marked longest ago, and Start today’s round opens it.',
    'The Robots have work waiting line ends “The next round takes the top row by itself while the Mac is awake. Nothing to press.” When a matrix is stuck it reads “A robot needs a person” and ends “The Console row says what it needs.”',
    'On Messages the Texts not delivered tile reads “Call them, or send it as an email.” under its count, the two presses its rows carry. A sent copy that could not be saved now reads “The copy was not kept. The send went out, and this row is the record.”',
  ],
}

export default note
