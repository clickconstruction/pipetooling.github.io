import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5131',
  date: '2026-10-09',
  title: 'GC mode: the presses behind a trade’s punch list, and a stricter daily log',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'GC mode can keep a trade’s punch list on a job we build: add an item, take one off that was added by mistake, check it fixed or send it back.',
    'The office can record that a trade says an item is fixed, and the trade’s own press is ready for its portal. An item taken off is kept, never deleted.',
    'The daily log now takes only our own crew and trades with a signed statement of work. A blank temperature is refused instead of saved as 0, and a trade on site keeps its start promise.',
    'Nothing on screen uses the punch list yet; its window comes next.',
  ],
}

export default note
