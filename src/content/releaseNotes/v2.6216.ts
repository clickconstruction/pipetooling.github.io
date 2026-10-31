import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6216',
  date: '2026-10-31',
  title: 'Accounts payable: a bill in an aging cell opens, gets its due date or its job, and the house takes a payment, from the cell',
  kind: 'feature',
  highlights: [
    'In the window behind an aging cell, press a bill’s number and it opens in the house’s own Edit window. The cell stays behind it and counts again when you save.',
    'A bill in the No due date cell offers Add a due date ›. The bill opens with the Due date box ready, and on Save it moves to its aging column.',
    'A bill under No job yet offers Pick a job ›. The bill opens with its job search ready, the same job flow the form has always had, with its PO checks.',
    'A house’s window offers Make a payment › at the bottom, which opens that house’s Apply Payment window over the cell. The Total row’s window spans every house, so it has no payment button.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
