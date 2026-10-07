import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4732',
  date: '2026-10-06',
  title: 'Lien desk: change the line under each bill on the pay page',
  kind: 'feature',
  highlights: [
    'The bold line under each code on a notice’s pay page sits in a shaded box. Press it and type what the owner should read, on the paper itself.',
    'The change is on the pay page only. The bill behind it and its payment page keep their own line, and Back to the bill’s line undoes it.',
    'The page label counts the changed lines, and the leader sees them before approving. They lock once the notice is sent for approval.',
    'A line that is only a note about mailing checks, or an old “migrated” placeholder, is no longer shown as the work.',
  ],
}

export default note
