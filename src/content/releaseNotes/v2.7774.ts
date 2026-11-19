import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7774',
  date: '2026-11-18',
  title: 'Pipeline: the board’s age chip is its own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the small chip that says how old a remembered Pipeline is lives in its own file, with tests.',
    'Nothing changes on screen.',
  ],
}

export default note
