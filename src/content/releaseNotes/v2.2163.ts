import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2163',
  date: '2026-08-23',
  title: 'Bids speak GC: the words, the tour, and the help guides',
  kind: 'feature',
  highlights: [
    'One sentence everywhere: versions draft this bid for different GCs; price options send more than one price to the same GC. The Pricing tour now opens on the Send to strip and tells it.',
    'Pricing: "＋ Another price or GC…" — Another price for this GC (offer it or keep it to compare), Another GC (opens the GC-first modal), Adopt an existing bid. "★ base · the GC sees this", "Make base", "price option" instead of "scenario".',
    'A GC on the bid\'s "Also sent to" list without a packet of its own now shows on the Send to strip, the Bid Board and Followup as "same letter as …" — with a one-click "track separately".',
    'Help guides rewritten around GCs: bid one project to multiple GCs, price a bid with the Workbench, try the new cover letter layout, read the bid board.',
  ],
}

export default note
