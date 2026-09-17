import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3544',
  date: '2026-09-17',
  title: 'Submittals: the robot reads, you confirm',
  kind: 'feature',
  highlights: [
    'Three asks on the Submittals tab: Ask the robot to read the schedule off the plans, Ask the robot to split a vendor PDF by tag, and Ask the robot to read the redlines on a reviewer\'s marked-up PDF.',
    'Nothing the robot reads counts until you confirm it: the schedule\'s tags come back as sure and want-a-look with a Confirm; the PDF\'s pages land on the sheet strip as dashed guess chips (Confirm N · pick M); the redlines come back as proposed calls (Confirm N · settle M) that land as read from the reviewer\'s file, confirmed by you, with the questions posted to the thread.',
  ],
}

export default note
