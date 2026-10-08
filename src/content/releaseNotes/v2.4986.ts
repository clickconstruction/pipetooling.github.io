import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4986',
  date: '2026-10-08',
  title: 'Dispatch: one place now decides which mode is on',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, moving or copying a block, linked copy, placing a job, adding to several cells and the job picker now run from one place.',
    'One written rule says which of them end when another starts. Nothing changes on screen, and each one starts, ends and answers Esc as before.',
    'The rule is a table with a test for every case, so each known gap can be fixed with a one-line change.',
  ],
}

export default note
