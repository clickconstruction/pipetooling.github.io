import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3783',
  date: '2026-09-23',
  title: 'Quickfill on a phone is a round: the sections as rows, one section per screen',
  kind: 'feature',
  highlights: [
    'On a phone Quickfill opens as a list of its sections instead of 27 open sections in one 28,000-pixel scroll: each row is the section’s name, its count, and when it was last looked at and by whom. Red rows are due, amber due today, grey not yet, green fresh; the personal doors (My Inbox, Schedule, Tomorrow’s schedule) sit at the bottom.',
    '“Due” is measured against each section’s own rhythm — how often it actually gets marked, from its last five marks — not a flat 30 hours. Accounts payable on a weekly rhythm stops being red every morning; a section with fewer than three marks keeps the old rule. The headline says how many are due, and Round · N opens the first.',
    'A section opens as its own screen: the question it answers on top, its count and last look, its own body, and at the thumb Skip and “Looked · N open · next”, which marks it for everyone (as the desktop ✓ does) and moves to the next due section. Texts, Email and Physical inbox keep their mark-with-a-note inside.',
    'Every input inside a section screen is 16 px, so the phone no longer zooms when one is tapped. The desktop page is unchanged.',
  ],
}

export default note
