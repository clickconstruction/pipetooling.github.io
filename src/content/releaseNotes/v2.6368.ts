import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6368',
  date: '2026-11-02',
  title: 'Job photos from the Job Mode card and the job window',
  kind: 'feature',
  highlights: [
    'The Job Mode card has a Photos line under the stage checklists with the job’s photo count. Press it and the Job photos window opens as a full sheet, with Take a photo first on a phone.',
    'The job window’s Documents tab Photos line opens the same window, with Add a photo beside it. A job with no Drive folder still takes a photo; the first one makes the folder.',
    'After you press Add, one line lands on the job’s activity naming the photos, so the office sees what was added. Nobody is pushed or emailed.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'helpers', 'subcontractor'],
}

export default note
