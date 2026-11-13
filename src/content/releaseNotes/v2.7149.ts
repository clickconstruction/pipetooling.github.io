import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7149',
  date: '2026-11-13',
  title: 'Dark theme: the row you picked reads on six more screens',
  kind: 'fix',
  highlights: [
    'In dark theme the row you picked drew as a near-white band with near-white words on Bids → Follow-up, the Prospect List, both Banking review tabs, the bids working board and the dispatch note picker. Each is a dark blue band now.',
    'Some words kept their light-theme colour on the dark page and were hard to read: a negative amount in People → Review and in Sub Labor, a loading figure on Job Summary. They take the theme’s colours now.',
    'Two greyed-out buttons use the same grey as every other one: + customer note on a bid with no customer, and Schedule’s add button while it saves.',
    'The check that guards the colours now reads this kind of line, so a new one cannot slip in.',
  ],
}

export default note
