import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2253',
  date: '2026-08-24',
  title: 'Roadmap Map: pointer menus, cleaner lines, review mode',
  kind: 'feature',
  highlights: [
    'Click any line between stages to remove it — the little menu names both stages before you cut.',
    'Right-click empty canvas → "Add stage here": the new stage is created exactly where you pointed.',
    'Lines now route around stage boxes instead of through them, and parallel lines get their own lanes.',
    '"Review stages" walks the map card by card in priority order — arrows to step, ▲▼ to bump a stage\'s priority on the spot.',
  ],
}

export default note
