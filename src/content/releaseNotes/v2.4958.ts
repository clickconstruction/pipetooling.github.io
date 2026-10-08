import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4958',
  date: '2026-10-09',
  title: 'A job that only carries bills stays off the crew screens',
  kind: 'infra',
  highlights: [
    'A job can now be marked as only carrying bills. GC mode will use it for each GC job we build, so our bills to the customer go through the Pipeline.',
    'Nobody can clock in on such a job, schedule it or add it to a crew, and the crew job searches leave it out.',
    'Nothing changes on screen yet.',
  ],
}

export default note
