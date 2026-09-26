import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3845',
  date: '2026-09-25',
  title: 'Get contracts signed banner reads quieter',
  kind: 'feature',
  highlights: [
    'The stage row at the right of the Get contracts signed banner is no longer four heavy pills competing with Start the sweep — it is one line of tappable counts, "19 waiting · 24 working · 50 billed · 7 collections", each still filtering the board to that stage.',
    'The small line under the headline no longer says "No floor" — that read like a job‑number floor. It now says "Counting every dollar" when nothing is skipped, or "Skipping jobs under $2,500" when a cutoff is set, with a "set a small‑job floor" link for dev when there is none.',
  ],
}

export default note
