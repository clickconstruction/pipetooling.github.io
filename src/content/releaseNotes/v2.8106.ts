import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8106',
  date: '2026-11-20',
  title: 'Sub papers: a second statement the same day keeps a period that reads forward',
  kind: 'fix',
  highlights: [
    'Make a statement of account, then open the papers again the same day. Since the last statement used to start tomorrow and end today, so the paper read Nov 21 to Nov 20.',
    'A statement made today no longer moves the period. It still starts after the last statement from before today, so the second paper covers the same days as the first.',
    'A payment typed after the first statement of the day is on the second one.',
    'The line under the period names the statement made today. When it was their first, the next one runs to date as well.',
  ],
}

export default note
