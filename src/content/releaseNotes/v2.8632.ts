import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8632',
  date: '2026-11-26',
  title: 'Lien desk: a payoff card with five stops for each place',
  kind: 'feature',
  highlights: [
    'In Payoffs, each place with a lien still on record has a card with five stops: Money recorded, Check clears, Releases, Recorded at the county and Copies sent. One line says what to do today, or that nothing is owed today.',
    'The day a release was asked for in writing is a value on the card, changed where it sits. The card then shows the day the release is due, ten days later, and counts the days left. One check for this place takes the same day with the check.',
    'A leader, a controller or a dev can press The bank confirmed the funds on a place whose check is at the bank, with a note of what the bank said. Those liens then offer Make the release, and the Release of record tab lets the release go.',
  ],
}

export default note
