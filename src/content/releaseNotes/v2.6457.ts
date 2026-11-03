import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6457',
  date: '2026-11-03',
  title: 'The Scoreboard opens a job to show who put what into it',
  kind: 'feature',
  roles: ['dev', 'controller', 'master_technician', 'assistant'],
  highlights: [
    'Press the arrow before a job on the Scoreboard. Under its nine figures are the people with their hours, days and labor, each sub, each supply house, each card holder, the tally, the other charges and the overhead day share.',
    'Every row fills Cost with what it put in, and a thin bar shows its share. The rows add up to the job.',
    'A Lead row led the crew on some of the days. The office row says who sent the bills and booked the payments.',
    'Your own rows are gold and say You. A leader or an assistant sees the people alone, with hours and days and no dollar.',
  ],
}

export default note
