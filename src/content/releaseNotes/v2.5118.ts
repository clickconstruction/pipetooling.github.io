import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5118',
  date: '2026-10-09',
  title: 'Job Parts Tally: mark a card’s Cash App pay sends as payroll in one press',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'On the Team queue, a purple bar sits above the cards when a card has Cash App pay sends. It says how many, how much and who the money went to.',
    'One press marks them all as payroll, so they leave the list. Undo on the message puts them back to sort.',
    'Only sends to a person go on the bar. A send noted as gas, Home Depot or a reimbursement stays off it, for you to sort.',
    'Only people who can mark payroll see the bar. It marks the sends and does not change a payroll rule.',
  ],
}

export default note
