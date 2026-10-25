import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5828',
  date: '2026-10-24',
  title: 'Quickfill Email: the history shows how the inboxes trend, not the list typed each morning',
  kind: 'feature',
  roles: ['assistant', 'controller', 'estimator', 'master_technician', 'dev'],
  highlights: [
    'The Email station’s history opens on four weeks of bars for each label it counts: how many threads sat each day, in red on a day the oldest was past the limit, with a mark under each day someone looked.',
    'Under the bars, two weeks day by day, the days nobody looked included: who looked, how many sat, the oldest, what came and cleared, and what sat past the limit by name.',
  ],
}

export default note
