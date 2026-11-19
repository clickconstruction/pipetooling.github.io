import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7764',
  date: '2026-11-18',
  title: 'Pipeline: the marks beside a billed row’s buttons are their own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the returned-check warning and the No bill line mark on a billed row live in their own file, with tests.',
    'Nothing changes on screen.',
  ],
}

export default note
