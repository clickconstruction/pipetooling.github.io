import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5020',
  date: '2026-10-09',
  title: 'Robot questions about a bid you have not priced yet carry no dollar figures',
  kind: 'fix',
  roles: ['estimator', 'master_technician', 'dev'],
  highlights: [
    'When a robot is shadowing a bid you have not priced yet, its questions about that bid no longer show its own guess at the job’s size. “An $800k restroom fit-out” now reads “a restroom fit-out” on Bids → Audits.',
    'Once the robot’s shadow run on that bid is scored, its questions can name amounts again.',
  ],
}

export default note
