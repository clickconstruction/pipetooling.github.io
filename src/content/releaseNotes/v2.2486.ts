import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2486',
  date: '2026-08-29',
  title: 'Job folders file themselves in Drive',
  kind: 'feature',
  highlights: [
    'A new behind-the-scenes service can create a bid’s job folder in the shared Drive folder, upload the plan set, and stamp the links on the bid — one call, for staff and agent seats alike.',
    'It runs on a dedicated service account (no human Google password anywhere) and activates once the account is connected.',
  ],
}

export default note
