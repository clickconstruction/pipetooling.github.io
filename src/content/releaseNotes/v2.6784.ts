import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6784',
  date: '2026-11-09',
  title: 'Research: the map, the hint beside who pulled it, and who wins what',
  kind: 'feature',
  highlights: [
    'Prospects → Research has a Map view: the same rows as pins, coloured by their lens, clustered when zoomed out, the office ringed. Click a pin to read the permit beside the map and decide on it there.',
    'Under who pulled a permit, one word reads our own bid history with that name: warm when we have won with them, cold after three priced bids and nothing won, new name when we never bid to them. Hover for the reason. It is a hint, never the verdict.',
    'Already have a plumber now opens with Who wins what: the plumbers named on the window’s taken jobs, most first.',
    'A Declared value filter keeps the small permits off the list: $25k and up, or not declared, by default. Pick Any value to see them all.',
  ],
}

export default note
