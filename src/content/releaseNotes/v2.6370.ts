import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6370',
  date: '2026-11-02',
  title: 'A job photo waits on the phone with no signal',
  kind: 'feature',
  highlights: [
    'A photo added to a job with no signal is kept on the phone. Its tile says so. Type the words and press Add as usual; the photos wait in the queue with the clock presses and reports.',
    'The waiting bar reads Job photos from 7:58 AM and 1 photo with it. When the signal is back the phone sends the photos first, then their words, and the line lands on the job’s activity.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'helpers', 'subcontractor'],
}

export default note
