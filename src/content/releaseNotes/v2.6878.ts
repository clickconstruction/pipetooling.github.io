import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6878',
  date: '2026-11-10',
  title: 'Labels: copies of each box, and a window that reads top to bottom',
  kind: 'feature',
  highlights: [
    'Copies of each sets how many strips print for every box, for boxes with more than one side. With 2, the strips come out as 1, 1, 2, 2, 3, 3.',
    'The print press names the total, as in Print 6 tape labels. The test strip is still one strip. The count is remembered on that computer.',
    'The window now reads in the order you work: what it prints on, which boxes and how many, the strips, then the print press at the bottom. The press stays in reach while the strips scroll.',
    'Once the P-touch is connected, one line names the printer and its tape. Use the print window instead moved under Printer setup.',
  ],
}

export default note
