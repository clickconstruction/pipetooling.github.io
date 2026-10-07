import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4817',
  date: '2026-10-07',
  title: 'Scheduled emails are sending again',
  kind: 'fix',
  highlights: [
    'From early Tuesday morning to about 1 pm Wednesday, the emails the app sends on a schedule did not go out.',
    'They were the crew day email, Money waiting, shared schedules, GC statement rounds and the test reports sent to the GC on their own.',
    'They run on their usual times again. If you expected one of them on Tuesday or Wednesday morning, check that it arrived.',
  ],
}

export default note
