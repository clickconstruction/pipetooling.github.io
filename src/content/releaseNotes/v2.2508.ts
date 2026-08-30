import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2508',
  date: '2026-08-30',
  title: 'Traced pipes now have to sit on the drawing — and review by layer',
  kind: 'feature',
  highlights: [
    'A registration gate scores every traced run against the plan\'s actual ink and refuses floating traces — it caught the twin\'s first pipe pass at 10% on-ink and drove the re-trace to 75–100%.',
    'Snap and follow tools pull vertices onto the linework and walk runs along the real ink, jogs included.',
    'Robot takeoffs now import as toggle-able layers — Fixtures, each pipe system, and Fittings on their own canvases — so reviewers flip lines on and off over the plan with the existing canvas controls.',
  ],
}

export default note
