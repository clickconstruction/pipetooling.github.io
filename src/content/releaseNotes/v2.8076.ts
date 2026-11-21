import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8076',
  date: '2026-11-20',
  title: 'Maps: a key Google refused once is remembered for the page',
  kind: 'fix',
  highlights: [
    'When Google has refused the map key on a page, a map opened later on that page now opens on the other map at once. Before, it showed an empty frame for eight seconds first.',
    'This covers a painted map opened after a job’s map or the Dashboard’s map had already fallen back.',
    'The small map on a permit card now hears a refused key the way every other Google map does, and no longer cuts the other maps off when it leaves.',
    'Nothing changes while Google accepts the key.',
  ],
}

export default note
