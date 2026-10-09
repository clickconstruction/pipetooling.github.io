import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5105',
  date: '2026-10-09',
  title: 'What customers see: the sample bid room is built like a real one',
  kind: 'fix',
  highlights: [
    'The sample bid room on Settings → What customers see is now built by the same code that publishes a real room, so it can only say what a real room would.',
    'It now shows a with-and-without alternate the GC can tick beside the proposal, as real rooms have since add-ons arrived.',
    'The signed sample reads the way a real signature is saved: the proposal and the alternate taken, with the total of both.',
  ],
}

export default note
