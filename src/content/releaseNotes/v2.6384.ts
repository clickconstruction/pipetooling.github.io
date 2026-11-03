import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6384',
  date: '2026-11-02',
  title: 'Lien desk: gate 4 says when no month is open, instead of asking for a tick',
  kind: 'fix',
  highlights: [
    'On a notice in the Sent pile whose every month’s window has closed, gate 4 read “No month picked · Tick at least one month below” over a grid with nothing to tick. It now reads “No month open”, and its row says every window has closed and the notice that went out is in the grid below.',
    'A job with months to pick still reads “No month picked” until one is ticked.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
