import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2408',
  date: '2026-08-27',
  title: 'Cover letter alternates read as the project, not the GC',
  kind: 'fix',
  highlights: [
    'An alternate\'s automatic label on the letter now uses the project name — "ALSATIAN value engineered", not "MERIT GENERAL CONTRACTORS value engineered" — the GC knows who they are; the project names the work.',
    'A packet and a price option sharing the same name print it once instead of twice.',
    'Wording you\'ve hand-edited on the preview is untouched, and your team\'s internal names on the Pricing tab don\'t change.',
  ],
}

export default note
