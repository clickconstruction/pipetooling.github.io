import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2162',
  date: '2026-08-23',
  title: 'Per-GC outcome — the Bid Board row expands into its GCs',
  kind: 'feature',
  highlights: [
    'A bid that went to more than one GC now shows a line per GC right under its Board row: sent when, ★ value, and an outcome select — won / lost — for that GC.',
    'Mark "won" with one GC and the bid rolls up to Won; when every GC that was sent says lost, the bid rolls up to Lost. A bid you already decided by hand is left alone.',
    'Followup → Full bid details shows the same "Sent to — by GC" list with outcomes.',
  ],
}

export default note
