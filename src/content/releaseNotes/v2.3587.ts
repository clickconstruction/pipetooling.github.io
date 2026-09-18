import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3587',
  date: '2026-09-18',
  title: 'Contract sweep: Look in Drive opens to the office',
  kind: 'feature',
  highlights: [
    'The Contract sweep\'s ⋯ → Look in Drive for signed contracts… was a dev-only door while the matcher proved itself. It now shows for every office role — master, assistant and controller too — so anyone working the sweep can file what the jobs Shared Drive already holds.',
    'Nothing else changes: the pass reads the Drive, matches by folder and file name, and files only what you confirm. Nobody is emailed.',
  ],
}

export default note
