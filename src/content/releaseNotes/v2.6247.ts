import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6247',
  date: '2026-10-31',
  title: 'Leaving the business-records preset gives the affiant their own role back (punch list #220)',
  kind: 'fix',
  highlights: [
    'In Swear a statement…, pressing What someone saw or heard after Business records now puts the roster’s role line back on the person picked. A role you typed yourself stays.',
    'Under Business records, the role line can be typed in again. It used to snap back to the rule’s role on every keystroke.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
