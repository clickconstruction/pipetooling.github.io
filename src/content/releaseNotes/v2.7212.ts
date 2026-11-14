import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7212',
  date: '2026-11-13',
  title: 'Materials on site: fix a part’s name that was typed wrong',
  kind: 'feature',
  highlights: [
    'In a box’s window, Contents now has Fix the name under each typed part. Type the right name and press Rename.',
    'The name changes in every box on the job that holds that part. The window says which boxes before you press, and warns when two lines would become one.',
    'The counts and the history stay as they are. Until now the only way was to count a part to zero and add it again, which read as a shortfall.',
    'Undo the rename puts the old name back. A part from the parts book keeps the book’s name.',
  ],
}

export default note
