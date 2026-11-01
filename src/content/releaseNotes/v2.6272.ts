import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6272',
  date: '2026-11-01',
  title: 'The job window’s Documents tab has a Photos line',
  kind: 'feature',
  highlights: [
    'Under the job folders, a Photos section says how many photos are in the job’s Drive folder, how many are on their way, and the day of the newest. Press the line to open the photos, the same viewer as the strip under the address.',
    'A job with no Drive folder says so there and points at Make the job’s Drive folders just above it.',
    'Every photo across every job is on Documents → Photos.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'],
}

export default note
