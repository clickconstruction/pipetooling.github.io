import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6155',
  date: '2026-10-30',
  title: 'Draft Payroll’s Cash Due as bars (punch list #217)',
  kind: 'feature',
  highlights: [
    'Draft Payroll’s Total | Left sentence is a bar under the dates: paid, owed and no report, each with its figure and its share of the period, and the caption counts paid against the people with pay due this period.',
    'The Status and Paid columns are one Cash due column: a bar per row reading paid on its day, paid and owed, or no report yet, and a blue Record payment for a report with nothing paid on it yet. The Review link stays beside the bar.',
    'The $ column draws its cents smaller, with salary 8h as a small line under a salaried person’s figure. An amber dot sits on each row whose clock sessions still wait, and the banner is one chip in the button row.',
    'The Every report is generated note sits under the table. The printable summary keeps its words.',
  ],
  roles: ['dev', 'master_technician', 'controller'],
}

export default note
