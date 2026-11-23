import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8340',
  date: '2026-11-23',
  title: 'Dashboard: My Bids groups your bids by state, one box a bid',
  kind: 'feature',
  highlights: [
    'My Bids groups your bids under Unsent, Not yet won or lost, Won and Started or Complete, each with its count. A bid no longer says its state on every line.',
    'Each bid is one box with its name across the full width. A press opens the bid’s window, which has a door to every tab of the bid. The Preview button is gone.',
    'Hide is a word press on each bid, and hidden bids wait in a Hidden group with Show again. Hiding every bid no longer makes the card disappear.',
    'A note on a sent or hidden bid now shows: a folded group still draws a bid with unread updates, and a hidden bid comes back until you press Mark read.',
  ],
}

export default note
