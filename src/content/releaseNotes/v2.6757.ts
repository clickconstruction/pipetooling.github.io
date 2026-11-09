import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6757',
  date: '2026-11-08',
  title: 'People and Jobs: Crew P&L, Review, the Scoreboard, the office job, tags, the activity grants and the fleet rules open to the owner; the payroll Balances and Payments views to the controller',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'The owner now opens Jobs → Crew P&L and People → Review, and the header’s Review icon shows for him. The phone menu’s Review link, which used to land him on nothing, lands on the tab.',
    'The owner sees the Scoreboard, picks the office job on Overhead, uses the Tags switch on Users, grants the Activity tab to others and sets the vehicle check-in rules and Wheels.',
    'The controller reads Payroll’s Balances and Payments views beside the pay run.',
  ],
}

export default note
