import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4593',
  date: '2026-10-05',
  title: 'Submittals: What the GC sees says what the link shows today',
  kind: 'fix',
  highlights: [
    'On a new draft, the line under the rows and the What the GC sees window used to say "The GC sees nothing until you share", even while the link still showed an earlier revision. Now they name it, like "Until you share Rev 4, the link shows Rev 2."',
    'A revision whose answers came by email and were typed in was never on the link, so it is skipped.',
    'When the review room is closed, both say the link shows only that the review is closed, and what to do to show your rows again.',
  ],
}

export default note
