import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8678',
  date: '2026-11-26',
  title: 'Paint a map: a test map thrown away keeps a copy, and Recently deleted puts it back',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'Throw this map away took a painted map for good. A map a walk threw away could not come back.',
    'When a developer throws away a map whose name starts with ZZ, the app now keeps a copy. Recently deleted puts the map back for 90 days, with its lines, places and links.',
    'The photos of that test map stay, so a place put back still shows its photo. A task or a place on Materials on site that carried the map does not get it back.',
    'Nothing changes for the crews or the office. A real map thrown away is gone as before, and its photos go with it.',
  ],
}

export default note
