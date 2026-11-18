import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7736',
  date: '2026-11-18',
  title: 'Pipeline: the tests for its lists share one setup',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the tests for the Pipeline’s tables and phone cards build their setup in one place. Three test files each had their own copy.',
    'Nothing changes on screen, and no app code changed.',
  ],
}

export default note
