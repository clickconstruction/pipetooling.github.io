import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2202',
  date: '2026-08-23',
  title: 'Vehicle check-ins: generated types catch up',
  kind: 'infra',
  highlights: [
    'Database types now include the new vehicle_checkins table, removing the interim casts from the check-in capture and history code. No visible changes.',
  ],
}

export default note
