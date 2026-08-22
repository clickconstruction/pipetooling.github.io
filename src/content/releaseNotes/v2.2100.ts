import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2100',
  date: '2026-08-22',
  title: 'Partner ledger reads like the statement',
  kind: 'feature',
  highlights: [
    'The weekly card now shows the math the way the paper statement does: "Week opened" at the top, the lines in the middle, and a bold "Week closed" total at the bottom where the arithmetic finishes.',
    'The total says whose money it is in plain words — "Click owes you" or "you owe Click" — instead of leaving you to read a minus sign.',
    'Empty "Labor · 0.0 h × $0" lines no longer appear on statements.',
  ],
}

export default note
