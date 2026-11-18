import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7723',
  date: '2026-11-17',
  title: 'Pipeline: a piece of code nothing used is gone',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, a small helper for the Pipeline’s table headers is removed. Nothing had used it for a long time.',
    'Nothing changes on screen.',
  ],
}

export default note
