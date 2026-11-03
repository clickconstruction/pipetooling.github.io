import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6410',
  date: '2026-11-02',
  title: 'A Pipeline search that cannot reach every job says so',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When the server does not answer, the search says only the jobs already on the board were searched. Before, it said No match anywhere.',
    'With no signal, Retry runs the search again, and it runs by itself when the signal is back. Paid in Full reads not searched until then.',
    'The # jump says it could not look the number up and keeps what you typed. It no longer says no job matches that number.',
  ],
}

export default note
