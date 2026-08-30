import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2511',
  date: '2026-08-30',
  title: 'Robot takeoff notes get a clean review loop',
  kind: 'feature',
  highlights: [
    'CountTooling shows takeoff notes as small numbered pins with a Notes drawer — no more paragraph blocks covering the drawing.',
    'Reviewers resolve an RFI or type an answer right in the drawer, and answers flow back to the estimating robot before its next pass.',
    'Robot notes now keep the on-sheet text short and carry their long trace notes in a detail field only the drawer shows.',
  ],
}

export default note
