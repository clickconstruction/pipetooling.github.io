import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4584',
  date: '2026-10-05',
  title: 'Demand letter: Print, Download and Email show what they are doing',
  kind: 'feature',
  highlights: [
    'Pressing Download PDF turns the button blue with Downloading… for at least a second and a half, then green with Downloaded for two seconds.',
    'Print packet does the same with Opening… and Opened.',
    'After an email goes, the Email with the PDF button turns green with Emailed. The Send button shows a spinner while it sends.',
    'Every button keeps the same size through all its states. Before, Download flashed Building… for a moment and shrank.',
  ],
}

export default note
