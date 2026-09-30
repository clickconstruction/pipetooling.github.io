import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4216',
  date: '2026-09-30',
  title: 'Draft Payroll: making one person’s report no longer opens a new tab',
  kind: 'fix',
  roles: ['dev', 'controller'],
  highlights: [
    'In People → Pay → Draft Payroll, the Report button on a person’s row makes their pay report and stays put — the report no longer pops open in a new browser tab.',
    'The row turns into View and Record payment as before, and a toast confirms the report is there. View still opens the report when you want to read it.',
  ],
}

export default note
