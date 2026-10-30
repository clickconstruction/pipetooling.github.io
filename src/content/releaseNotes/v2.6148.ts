import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6148',
  date: '2026-10-30',
  title: 'A person’s hours as fourteen days, and the pending days on the clock strip (punch list #217, people-docs-6 and -15, prototypes)',
  kind: 'feature',
  highlights: [
    'On a person’s desk, Hours & approvals has a new press, Show the strip. It draws the last fourteen days: a dot on each approved day, an amber ring on each day with a session waiting, the hours under every day, a grey line at the last reviewed day, today outlined.',
    'On People → Hours, Show the strip puts an amber ring on each day of the clock strip with a session waiting, its hours under it, and a stub at the left, like 7 earlier, that opens the all-weeks queue. The amber banner keeps Review & approve and All weeks and loses its sentence.',
    'The Hours tab’s Review Hours press now says what is reviewed, like Reviewed through Oct 18, and shows its ✓ only when every person shown has a review on record.',
    'Each press is remembered for you on this device and is off until you turn it on.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
