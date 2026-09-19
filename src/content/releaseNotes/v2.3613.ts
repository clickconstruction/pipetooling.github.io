import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3613',
  date: '2026-09-19',
  title: 'Supervision, PR 3: My crew on the Dashboard — reports owed, and your crew\'s hours read-only',
  kind: 'feature',
  highlights: [
    'Anyone who supervised a job-day this week — a master, or a helper or sub the office has marked as able to run a job — gets a My crew section on their Dashboard. Nothing is assigned; it is read from the schedule and the clock.',
    'Reports owed: one line per job-day you supervised with no report yet, the crew you had underneath, and a Write it button that opens the report for that job. Filed ones are counted.',
    "My crew's hours: your crew's clock sessions on those job-days, by person and day, read-only. No approve button — approval stays with the office.",
    'A helper or sub who still needs supervision sees nothing here; step weeks with the arrows.',
  ],
}

export default note
