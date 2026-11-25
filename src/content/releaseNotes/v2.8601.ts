import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8601',
  date: '2026-11-25',
  title: 'Papers before a job opens: declining a GC’s proposal needs a reason',
  kind: 'fix',
  highlights: [
    'When you decline a GC’s proposal of stricter settings, Decline the proposal now stays grey until you type a reason.',
    'Before, an empty box went through, and the GC’s page had no reason to show.',
    'Nothing else about a proposal changed. Take it works as before.',
  ],
}

export default note
