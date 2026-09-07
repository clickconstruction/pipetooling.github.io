import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2961',
  date: '2026-09-06',
  title: 'Developer docs, second pass',
  kind: 'infra',
  highlights: [
    'Nothing changes in the app. The developer reference was checked against the code a second time: the edge-function index gained its one missing entry, the page-access matrix now says subs and helpers can open Settings (they always could), and the large-file inventory was re-measured.',
  ],
}

export default note
