import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2031',
  date: '2026-08-21',
  kind: 'fix',
  title: 'Nightly smoke checks are green again',
  highlights: [
    'One of our automated after-deploy checks had been failing since the Sub Labor form got its standard job search — the check still expected the old free-text Job # box. The check now matches the current form; no app behavior changed.',
  ],
}

export default note
