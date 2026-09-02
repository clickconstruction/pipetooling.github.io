import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2634',
  date: '2026-09-02',
  title: 'Faster dashboard loads for superintendents',
  kind: 'fix',
  highlights: [
    'Superintendent dashboards were quietly fetching bid data that never displayed — those wasted queries are gone, so their dashboard loads a little lighter.',
  ],
}

export default note
