import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4582',
  date: '2026-10-05',
  title: 'Release of Lien: every way into Unconditional asks first',
  kind: 'fix',
  highlights: [
    'The question "Are you sure you meant to choose Unconditional?" now comes up on every way into an unconditional waiver, not only the switch in step 2.',
    'It asks when you press Waive the paid money, when Issue unconditional opens the window, and when a paid bill picks Unconditional by itself.',
    'Stay conditional keeps you on the conditional form. From Issue unconditional it closes the window, because that window was opened for the unconditional.',
    'A draft you already started is not asked again.',
  ],
}

export default note
