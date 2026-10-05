import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4576',
  date: '2026-10-05',
  title: 'Submittals: an arrow shows where the next revision starts',
  kind: 'feature',
  highlights: [
    'When rows were sent back, a dashed arrow marked "Next revision" runs from step 7 back up to step 2.',
    'It shows the loop the button starts: a new revision at step 2, then steps 3 to 6 again.',
    'The label stays in view as you scroll, however many steps are open. The arrow is left out on a phone, where there is no room for it.',
  ],
}

export default note
