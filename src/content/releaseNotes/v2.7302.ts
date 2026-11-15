import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7302',
  date: '2026-11-14',
  title: 'The affidavit always names the month of the last day on site',
  kind: 'fix',
  highlights: [
    'The lien affidavit’s line Payment is requested for work done and materials furnished in … now always names the month of the job’s last day on site. That day is the latest approved clock day, or the day set by hand on the Lien desk.',
    'The months a recorded § 53.056 notice names inside the job’s own dates of work still print beside it. Until now a job whose notice named only earlier months printed a blank there.',
    'When no notice on record names that last month, the Ask the attorney line says so, on the pane, the Lien window, the help sheet and the notice record. Nothing is held.',
    'The line above Send for approval still says the last month’s notice is due and by which day. It now says the paper names the month already, so record the notice and the month has one behind it. Months set by hand stand as typed.',
  ],
}

export default note
