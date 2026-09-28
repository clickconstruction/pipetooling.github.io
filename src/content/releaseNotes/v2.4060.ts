import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4060',
  date: '2026-09-28',
  title: 'Plug in quotes: hand-added lines and half-saved quotes fixed',
  kind: 'fix',
  highlights: [
    'Lines added by hand could get tangled after one was removed — typing a price filled two rows, and Remove took both. Each hand-added line is its own again.',
    'If a quote\'s lines fail to save, the quote is taken back instead of sitting on the bid empty, so trying again no longer saves the quote twice. If only the price memory fails, the quote is kept and you are told the memory did not update.',
  ],
}

export default note
