import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5863',
  date: '2026-10-25',
  title: 'The Labor tab saves only after you edit',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'estimator'],
  highlights: [
    'The Labor tab’s autosave now runs only after you change something. Before, just opening or reloading the tab — for example after a Put back from History — quietly rewrote every row with the same values.',
    'The GSA travel lookup and a direct cost’s description now count as edits, so they save the same way your typed numbers do.',
  ],
}

export default note
