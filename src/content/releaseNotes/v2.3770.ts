import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3770',
  date: '2026-09-23',
  title: 'Record a lien notice that already went out',
  kind: 'feature',
  highlights: [
    'A § 53.056 notice printed here and mailed by hand — sometimes one paper for several jobs at a property — can now be recorded after the fact: “Already mailed? Record it…” on the Lien desk’s pane and beside “Save & record sends…” in the Lien window.',
    'You type when it went out, how, to whom, the claim and the months as printed, and the saved copy’s link; the pane lists the other unpaid jobs at the same property to tick. It writes one record per job the paper covered, on one packet, and the desk stops asking for those notices — an awaiting draft moves to Sent, and the other jobs read as noticed in the GC run.',
    'The paper is recorded as printed. When its claim differs from what the app would have claimed, the line says so — “printed $28,987 · the app’s timely claim would have been $9,802” — and the difference stays on the record.',
    'The Fix-ups chip for owners to confirm no longer says “with approved hours”: a job with none is on the list too since the last release.',
  ],
}

export default note
