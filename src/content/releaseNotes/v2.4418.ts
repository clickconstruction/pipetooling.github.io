import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4418',
  date: '2026-10-02',
  title: 'Pricing: "Bids like this" replaces the history box',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The history box on Bids → Pricing is now one line. It says how bids this size went, how this GC\'s bids went, and where your margin stands.',
    'Compare opens the bids behind it: a bar of what happened to every bid this size, and the ones you won or lost on price by name.',
    'A bid the GC lost is counted apart, and a recorded bid tab shows how far over the low you were.',
    'The margin scale now fits its dots. Before, every past bid piled up at the right edge. It also no longer calls a margin below every win a winning range.',
  ],
}

export default note
