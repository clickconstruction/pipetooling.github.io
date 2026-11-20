import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8101',
  date: '2026-11-20',
  title: 'Papers: the server checks who sends a paper for signature',
  kind: 'fix',
  highlights: [
    'Sending a paper for signature is checked on the server as an office act: a dev, a leader, an assistant or the controller.',
    'A training account cannot send one. Nothing changes on the screens.',
  ],
}

export default note
