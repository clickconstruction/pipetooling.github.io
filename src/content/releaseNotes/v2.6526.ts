import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6526',
  date: '2026-11-04',
  title: 'Every stint a returner worked shows on their desk, and tenure counts from the day back',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A person who left and came back has their desk’s Employment row list every stint, newest first, with the time away between: “Nov 5, 2029 → present · this stint”, “away 3 years”, “Mar 4, 2024 → Nov 3, 2026 · 2 years 7 months”.',
    'People → HR and People → Pay → Employment count tenure from the day back and name the earlier stints after it.',
    'Salaried pay counts the days of every stint, so a week from before they left is not clamped to zero by the new start date when a report is run again.',
  ],
}

export default note
