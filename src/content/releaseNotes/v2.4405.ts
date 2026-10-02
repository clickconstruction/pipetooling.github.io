import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4405',
  date: '2026-10-02',
  title: 'Bids: every old bid is now marked Combined in the records',
  kind: 'infra',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Nothing changes on screen. 151 old bids were still marked By Stage in the database, mostly because that was once the default.',
    'They are now marked Combined, which is how the app already treated them.',
    'Their "last updated" dates were left alone, so no old bid looks freshly edited.',
  ],
}

export default note
