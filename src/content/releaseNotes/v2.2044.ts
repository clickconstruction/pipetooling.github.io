import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2044',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Call mode: the promise builder',
  highlights: [
    'The Friday quick-picks are gone. "They gave a date" now speaks all three languages of the phone call: an exact date, "in N days" (chips for 7/14/21/30), or "N days after billing" (net 15/30/45/60).',
    "In net-terms mode each bill lands on its own date, computed from its bill date — green landing chips preview on the bill lines as you choose, and the button echoes the outcome (\"Mark 3 promises · Sep 7 – Sep 23\") before you commit.",
    "Keys for phone-in-hand speed: 1–4 tap a chip, Enter marks the promise, C can't reach, → skips.",
  ],
}

export default note
