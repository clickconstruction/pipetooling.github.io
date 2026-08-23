import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2116',
  date: '2026-08-22',
  title: 'Partner ledger card: easier to read, especially on a phone',
  kind: 'feature',
  highlights: [
    '"Week opened" now says whose money it is in words — "you owe Click" / "Click owes you" — the same way the total at the bottom does, instead of a bare minus sign you had to translate.',
    'Labor hours show to the hundredth (40.55 h) so hours × rate works out on paper, and the card and the Full ledger now quote the same hours for the same week.',
    'Phone-friendly: the week navigation stays on one row ("Week of May 3"), dates are short, and the Full ledger keeps your running balance on screen instead of off the right edge.',
    'Very long line labels clip to two lines with a more / less toggle, and the office form now reminds whoever types a charge that the description is what you will see on your ledger.',
  ],
}

export default note
