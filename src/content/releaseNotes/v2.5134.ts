import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5134',
  date: '2026-10-09',
  title: 'GC mode: the Friday report’s draft, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'GC mode can now draft a job’s weekly report to the customer from the week’s records: the finish, the schedule, the daily logs, inspections, what held work up, next week and change orders.',
    'Nothing on screen uses it yet. The report window and its send come next.',
  ],
}

export default note
