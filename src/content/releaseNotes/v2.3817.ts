import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3817',
  date: '2026-09-25',
  title: 'Lien desk: a clearer "Put a GC on notice" list and a two-line header',
  kind: 'feature',
  highlights: [
    'The GC list under “Put a GC on notice…” shows each GC on its own line with the money lined up, then how soon the earliest window closes (“closes Oct 15 · 20 days”, red inside a week) and what is stuck: owners missing, notices awaiting approval, months missed.',
    'A GC whose windows have all closed drops to the bottom under “Nothing left to claim”, greyed, with “the lien is gone · chase it in Collections” — before, one sat fourth because of its dollars. A GC with a window closing inside a week moves to the top.',
    'The Lien desk header is two lines: the tabs and § The rules on the first, the piles (Needs the owner, To draft, Awaiting approval, Missed) and Put a GC on notice on the second.',
  ],
}

export default note
