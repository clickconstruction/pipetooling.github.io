import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4330',
  date: '2026-10-01',
  title: 'Lien waivers: the unconditional waits for a check to clear',
  kind: 'feature',
  highlights: [
    'When a bill is paid by check, the unconditional waiver waits seven days before the app asks for it. The bank can still send a check back in that time.',
    'The Bill tab and GC Review read Unconditional · waits for the check · clears Oct 8. View bill says the same.',
    'The waiver window still opens the unconditional, and says when the check clears. A card, a bank transfer or cash does not wait.',
  ],
}

export default note
