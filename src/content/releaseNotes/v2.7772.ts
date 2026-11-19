import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7772',
  date: '2026-11-18',
  title: 'Pipeline: the contract windows are drawn by their own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the Contract window, the sheet for a builder’s subcontract and the contract sweep on the Pipeline are drawn from their own file.',
    'Nothing changes on screen. Each window opens from the same presses as before.',
    'New tests cover what each window is handed and what its presses do.',
  ],
}

export default note
