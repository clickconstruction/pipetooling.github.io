import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3131',
  date: '2026-09-07',
  title: 'Your jobs on a map, on every Dashboard',
  kind: 'feature',
  highlights: [
    'A new card above your Assigned Jobs plots every active job you\'re on — blue pins for Working, amber for Waiting — with the counts as the key. Superintendents also see the jobs on their assigned projects.',
    'Click a pin for the job\'s card: number, name, address, its stage and last report, then Open job (the same window as your job rows) or Directions (Google Maps). On a phone the selected job shows as a bar under the map with big buttons.',
    'Fit all re-centers on every pin; Hide map collapses the card and remembers that on your device. A job whose address hasn\'t been placed yet is listed under the map, still one tap from opening.',
  ],
}

export default note
