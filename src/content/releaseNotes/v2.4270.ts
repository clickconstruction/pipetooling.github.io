import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4270',
  date: '2026-09-30',
  title: 'Lien calendar: two inks for two deadlines, marks that stand on one line, and rows that breathe',
  kind: 'feature',
  highlights: [
    'Notice flags are amber and lien flags are slate — the same two colours the density strip already used — so at a glance you can tell a letter to send from a filing to make. The column headers and the counts on a GC’s row carry the same two inks; red still means inside a week.',
    'Every mark stands on one line: flag poles end at the track, the work tick is short and sits on it, and the pay dot is centred on it. The “no hours” stand-in reads quietly as “Aug · no hours” in small amber instead of a bold sentence on most rows; the full explanation is the hover and the key.',
    'Rows are a little taller, alternate rows carry a faint tint instead of a hairline under each one, the column rules are dashed and lighter, and a GC’s row gets a stronger top rule and a larger name so groups stay visible when you have scrolled deep.',
  ],
}

export default note
