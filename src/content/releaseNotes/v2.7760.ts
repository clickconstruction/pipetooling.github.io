import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7760',
  date: '2026-11-18',
  title: 'Pipeline: a partial invoice is written by the same tested piece as Edit Job',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, Partial invoice on a Pipeline card writes its bill line through the same tested code Edit Job uses. The Pipeline had its own copy.',
    'Nothing changes on screen. The same line is written, and the same words show when a write fails.',
    'New tests cover the line that is written, an amount over what is left, and each kind of failure.',
  ],
}

export default note
