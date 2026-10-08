import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4943',
  date: '2026-10-09',
  title: 'GC projects: change orders and Money for the owner, the leaders and the controller',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'On GC projects, the owner, the leaders and the controller now see Money and the Change orders on a won job. Before, only a dev did.',
    'Assistants and estimators keep the board, Trade partners and Follow up, but not our money with the customer.',
    'Our terms with the customer, such as the retainage and the days to pay, are for the owner, the leaders and the controller to change.',
  ],
}

export default note
