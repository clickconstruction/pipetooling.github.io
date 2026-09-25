import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3832',
  date: '2026-09-25',
  title: 'Dashboard: assistants see the Payroll line in the Payables list',
  kind: 'fix',
  highlights: [
    'Opening the Payables (AP) card as an assistant listed Sub labor and Supplies but no Payroll — even though the card’s total and the list’s own total both included what the team is owed.',
    'The list now shows Team payroll as one Payroll line with the number of open pay reports, so the rows add up to the total. Individual pay amounts stay private, as before.',
  ],
}

export default note
