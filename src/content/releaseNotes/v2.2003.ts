import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2003',
  date: '2026-08-21',
  title: 'Cover letter: dollar figure on its own line',
  kind: 'feature',
  highlights: [
    'The proposal amount line now puts the numeric figure — "($58,821.98)" — on its own line under the spelled-out words, so it stands out instead of trailing off the end of the sentence.',
    'Applies everywhere the cover letter goes: the preview, the copied document, and the approval PDF.',
  ],
}

export default note
