import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5133',
  date: '2026-10-09',
  title: 'GC projects: the leaders and the controller bill each trade’s work',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'Bill the customer drafts each trade’s line from the work it reported for the owner, the leaders and the controller, as it does for a dev. It no longer drafts a trade at $0.',
    'Money shows what each trade was paid, approved and held for all of them too.',
    'The owner, the leaders and the controller read each trade’s statement of work on the project’s card. Only a dev sends one to sign for now.',
  ],
}

export default note
