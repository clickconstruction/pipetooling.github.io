import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4475',
  date: '2026-10-03',
  title: 'Billed ages and the Collected chart keep today after 7 pm',
  kind: 'fix',
  highlights: [
    'After 7 pm Central, every bill on the Pipeline read a day older. So did the printed Billed report, the aging chart, the GC review and the jobs map. They now count to today on the company’s calendar.',
    'The Collected chart started its last bar on tomorrow in the evening, so today’s payments sat one bar early. Its 30 days now end today.',
    'A few other counts used tomorrow in the evening too: the robot queue’s stale bids, the Person Desk’s 90 days, the phone’s page suggestions and a team member’s time with us.',
  ],
}

export default note
