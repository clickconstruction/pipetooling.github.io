import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5166',
  date: '2026-10-10',
  title: 'GC projects: one Pipeline job counts once, for a crew or for general conditions',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'A crew’s Pipeline job picker shows the job a GC job’s general conditions are spent on as On general conditions already, and it cannot be picked.',
    'On Our number, the general conditions picker shows a job a crew already uses as On Plumbing already, and it cannot be picked either.',
  ],
}

export default note
