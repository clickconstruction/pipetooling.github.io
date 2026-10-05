import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4584',
  date: '2026-10-05',
  title: 'Demand letter: Download PDF shows that it is downloading',
  kind: 'feature',
  highlights: [
    'Pressing Download PDF turns the button blue with Downloading… for at least a second and a half, then green with Downloaded for two seconds.',
    'The button keeps the same size through all three states. Before, it flashed Building… for a moment and shrank.',
  ],
}

export default note
