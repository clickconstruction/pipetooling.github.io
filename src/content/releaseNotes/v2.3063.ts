import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3063',
  date: '2026-09-07',
  title: 'Settings → Active accounts: no dead Convert button, no leader to pick when archiving',
  kind: 'fix',
  highlights: [
    'The "Convert Leader to Assistant/Subcontractor" section is gone — its server side never shipped, so the button could only fail. Change a role from the account row instead.',
    'Archiving an account that still holds customers no longer asks which leader inherits them: they are filed under the company owner account, like everything else since one company.',
  ],
}

export default note
