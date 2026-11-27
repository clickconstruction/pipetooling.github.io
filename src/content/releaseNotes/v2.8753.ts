import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8753',
  date: '2026-11-27',
  title: 'Small buttons with an outline take a full fingertip on a phone',
  kind: 'fix',
  highlights: [
    'On a phone, small buttons in a job’s window and on the Lien desk take a press across a wider area than they are drawn.',
    'On a button with an outline that area was 2 points short of a fingertip. It now reaches the full 44.',
    'Nothing looks different and nothing moves.',
  ],
}

export default note
