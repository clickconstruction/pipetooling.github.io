import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4207',
  date: '2026-09-30',
  title: 'Submittals: a step\'s title jumps into it, the same as its pill',
  kind: 'feature',
  highlights: [
    'Tap a step\'s title on the road and the step opens and its buttons ring, the way tapping its pill does. The page moves only if the buttons would be out of view, and then just enough — never from under your finger.',
    'The small ▴ after the title is now the fold: tap it to fold a finished step back to its line, or to unfold one without the ring.',
  ],
}

export default note
