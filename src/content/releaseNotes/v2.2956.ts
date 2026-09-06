import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2956',
  date: '2026-09-06',
  title: 'Developer docs re-verified',
  kind: 'infra',
  highlights: [
    'Nothing changes in the app. The developer documentation was audited against the code: the entry pages now point at the per-version changelog files instead of the frozen archive, seven links to removed files were repaired, and the table, function and test counts were brought current.',
  ],
}

export default note
