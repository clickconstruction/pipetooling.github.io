import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6373',
  date: '2026-11-02',
  title: 'A development’s History shows the crews’ photos in line, at the time they were taken',
  kind: 'feature',
  highlights: [
    'A site’s History now draws the crews’ photos among its lines, placed by the time each was taken. Photos on one job by one person within an hour read as one line with up to four small pictures and a + N tile for the rest.',
    'Press a picture to open it at full size. Previous and Next walk the batch; Only Deon’s photos puts the name in the search box.',
    'The chip row under the search box gains Photos, and the search finds a photo by its caption, its stage or who took it.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
