import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3176',
  date: '2026-09-09',
  title: 'Job Summary: job number, name and address in one column',
  kind: 'feature',
  highlights: [
    'On Jobs → Job Summary the Job #, Name and Address columns are now one Job column: trade pill, number and name on the first line, the address in small grey type on the second.',
    'Rows drop from four wrapped lines to two, and the money columns from Revenue through $/hr get the width back, so True % and $/hr stop scrolling off the right edge on a laptop.',
    'A long address is cut short with … — hover it to read all of it. Sorting by job number still works from the Job header; the write-down and collections chips keep their place.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
