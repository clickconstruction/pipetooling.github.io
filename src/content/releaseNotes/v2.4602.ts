import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4602',
  date: '2026-10-05',
  title: 'People → Spending: who is spending what on the company cards',
  kind: 'feature',
  highlights: [
    'A new Spending tab on People shows how much each person spent on the company cards, for any period.',
    'Each row splits the spend into fuel, what is on a job and what is not on a job yet. The numbers follow the same rules as a job’s cost.',
    'Open a person to see their jobs and the charges still waiting. Put on a job opens the same window Team purchases uses.',
    'Charges marked as payroll show only to people with payroll access.',
  ],
}

export default note
