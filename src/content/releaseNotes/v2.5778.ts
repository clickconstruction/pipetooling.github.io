import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5778',
  date: '2026-10-23',
  title: 'Quickfill: a Focus view that keeps only the groups with work open',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'A Page / Focus switch sits beside the Quickfill title on a desktop or tablet. Focus keeps every station with work open and folds the rest to one line each: the stations at zero, the ones marked today, and the three doors with no mark.',
    'A station at zero keeps its ✓ Mark on its line, so a clean day still gets stamped. Open now on any line opens the station in place, exactly as it does on a marked one.',
    'The switch remembers your choice on this device. A link can open either view with ?view=focus or ?view=page on the address.',
    'On a phone nothing changes: the round is already one station at a time.',
  ],
}

export default note
