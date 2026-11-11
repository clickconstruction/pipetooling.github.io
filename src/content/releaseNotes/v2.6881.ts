import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6881',
  date: '2026-11-10',
  title: 'Labels: a run of tape strips wastes one blank square, not one per strip',
  kind: 'feature',
  highlights: [
    'A run of tape labels now wastes one blank square of tape at its start. Before, every strip threw one away.',
    'Each strip is still cut from the next, and the last one feeds out by itself.',
    'A single strip, or the test strip, still carries its own blank square. Printing strips together saves the most tape.',
    'If a run stops part way, the window says a printed strip may still be inside the printer and how to get it out.',
  ],
}

export default note
