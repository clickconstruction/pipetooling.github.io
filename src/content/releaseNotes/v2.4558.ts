import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4558',
  date: '2026-10-05',
  title: 'Put a GC on notice: printing the run marks the notices printed',
  kind: 'fix',
  highlights: [
    'When you print the packet from the run inside Put a GC on notice, the notices now move to In the mail · tracking owed on the Lien desk.',
    'Before, only a run opened from the Lien desk did that. A run printed from Put a GC on notice left its notices in Ready to send.',
  ],
}

export default note
