import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7464',
  date: '2026-11-16',
  title: 'Plans: Change the link on a set that is already saved',
  kind: 'feature',
  highlights: [
    'A saved set of plans now has a Change the link press, on a job’s Documents tab under Plans and on a development’s Plans look. Paste the new Drive link and press Save the link.',
    'Use it when a set’s link points at a file that is not ours. Keep our own copy in Drive and point the set at it.',
    'The set stays the same set. Its name, its dates, its change line and the sets that followed it are untouched.',
    'When a job builds from that set, Open plans on every job on the same part opens the new link by itself. A set with no link yet says Set the link.',
  ],
}

export default note
