import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2005',
  date: '2026-08-21',
  title: 'Cover letter preview: amount line easier to scan',
  kind: 'fix',
  highlights: [
    'On the cover letter preview, the line now breaks after "in the amount of:" with the full amount — words and figure together — on its own line, so you can spot the number at a glance.',
    'This is a screen-only change: the document you copy, print, or PDF keeps the normal single-line sentence.',
  ],
}

export default note
