import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6262',
  date: '2026-11-01',
  title: 'Turnaway takes a photo',
  kind: 'feature',
  highlights: [
    'The Turnaway form takes a photo under the reason: the locked gate, the empty lot, the site not ready. On a phone the camera opens; at a desk a file picker does. The photo is shrunk and filed in the customer’s Drive folder like a field report’s, named by the reason.',
    'The press names what it files, as in File Turnaway · 1 photo, and waits while a shot is still on its way. Dispatch’s line ends with 1 photo on the report, so the office opens the report and sees the proof before the trip charge.',
  ],
  roles: ['subcontractor', 'helpers', 'superintendent', 'master_technician', 'primary', 'estimator'],
}

export default note
