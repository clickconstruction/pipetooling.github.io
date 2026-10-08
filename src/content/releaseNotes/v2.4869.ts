import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4869',
  date: '2026-10-07',
  title: 'Schedule Dispatch: one less time-off read each time the week loads',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'Each time a Schedule Dispatch week loaded, it read everyone’s time off twice when anyone on the roster was archived. Today the roster has 8 archived people, so every load did.',
    'It now reads time off once per load. The board shows the same chips as before.',
  ],
}

export default note
