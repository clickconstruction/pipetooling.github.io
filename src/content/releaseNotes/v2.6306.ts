import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6306',
  date: '2026-11-02',
  title: 'Find a file: the line where the words appear, with the words in bold',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Under a found file, a line now shows where your words appear, with the words in bold, so you know it is the right file before you open it.',
    'The line shows for a Google Doc, Sheet or Slides, a PDF with real text, and a text file. A scanned paper says Matched inside the scan. A very big file says it is too big to read here.',
  ],
}

export default note
