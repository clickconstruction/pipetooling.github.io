import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3620',
  date: '2026-09-19',
  title: 'Digital twins: the app directory is checked against the app on every PR',
  kind: 'infra',
  highlights: [
    'The briefs the digital twins navigate by (docs/twins) are now checked in CI: every page path they name must be a real route, and every help link a real guide. A renamed page or guide fails the build instead of stranding a twin.',
  ],
}

export default note
