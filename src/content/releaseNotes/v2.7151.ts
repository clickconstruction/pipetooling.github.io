import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7151',
  date: '2026-11-13',
  title: 'Pay calendar: a job’s own calendar is one press from the job',
  kind: 'feature',
  highlights: [
    'The job window’s Edit tab has a new row, Pay calendar. It says whose calendar the job reads: its customer’s, its own, or none.',
    'Press the row to open the pay calendar on that job. Pick the choice that names the job to set it apart from its customer.',
    'Pay speeds, opened from a job’s row on the Pipeline, opens the pay calendar on that job too.',
    'Fixed: Their paper’s Set pay calendar press was missing when the sheet was opened from the job window or Bill Customer.',
  ],
}

export default note
