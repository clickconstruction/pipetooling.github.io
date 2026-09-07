import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3015',
  date: '2026-09-07',
  title: 'Safety net under Projects Forecast',
  kind: 'fix',
  highlights: [
    'The loaders behind Projects → Forecast now have 5 tests pinning which jobs and stages are charted and how a project with two workflows, or none yet, is handled; no behaviour change.',
  ],
}

export default note
