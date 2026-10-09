import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5022',
  date: '2026-10-09',
  title: 'GC Review: a GC’s statement waits for this week’s check',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'Share → Draft Message, Copy and Print on a GC’s row now wait until that GC’s bills are checked this week. Until then the menu says “Check the bills first — a statement never goes out unchecked”, the same words as the row’s Send.',
    'A GC whose bills changed after the check waits for the re-check. A GC that owes only in Collections has nothing to check, so its Share works as before.',
    'The app’s own sends hold too. Send statement shows the same words. A scheduled statement for a GC not checked that week does not go, and a weekly schedule carries on to the next week.',
    'Share all and Print all, grouped by GC, leave out a GC not checked this week and say so, for example “3 sent · 2 held: not checked this week”. The emailed report names who was left out. Grouped by development, every section goes.',
  ],
}

export default note
