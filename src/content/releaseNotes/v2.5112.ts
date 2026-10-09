import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5112',
  date: '2026-10-09',
  title: 'What customers see: the sample estimate offers options like a real one',
  kind: 'fix',
  highlights: [
    'The sample estimate on Settings → What customers see is now saved and read by the same code as a real estimate, so it can only offer what a real estimate would.',
    'It offers two choices, with the recommended one picked to start, and an add-on the customer can tick.',
    'The sample estimate email now lists each option with its price, as the real email does.',
  ],
}

export default note
