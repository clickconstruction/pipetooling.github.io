import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5059',
  date: '2026-10-09',
  title: 'GC mode: the schedule’s call list is in the app',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The GC mode schedule’s call list is now part of the app, as it was tried in the design spike: everyone whose answer moves the chart, late first, with every reason under their name.',
    'Nothing shows it yet. The Schedule window draws it once moving bars is in.',
  ],
}

export default note
