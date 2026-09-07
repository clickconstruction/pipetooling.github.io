import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2996',
  date: '2026-09-07',
  title: 'Team board: the Edit Job link lands on a week that has the job',
  kind: 'fix',
  highlights: [
    'Opening the Team board from Edit Job\'s labor panel used to land on the current week, where a finished job has no row, so nothing was highlighted. It now jumps to the job\'s most recent week with clocked hours, says so in a toast, and highlights the row.',
  ],
}

export default note
