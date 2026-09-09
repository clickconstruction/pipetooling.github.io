import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3179',
  date: '2026-09-08',
  title: 'Job costs count recorded time, not just approved time',
  kind: 'feature',
  highlights: [
    'A clock session counts toward its job’s labor cost as soon as it is closed — approved or still awaiting approval. Before, a salaried tech’s day showed up on the job at 6 PM and an hourly punch waited for a reviewer; now the Job window’s Team labor row, the Cost Timeline’s 👷 markers, Job Summary’s Labor column, and the Pipeline man-hours all read the same recorded time.',
    'The day split follows the clock: clocking in already puts the person on that job for the day, so a salaried 8 h lands at 8:05 AM, not after the evening auto-approval. Rejecting or revoking a session takes it back out everywhere.',
    'Approval stays the payroll gate. Pay stubs, Draft Payroll, the overhead pool and the week close still count approved hours only. Job Summary’s pending chip now reads "N sessions await approval · H h in Labor, not yet in Hours or overhead".',
  ],
}

export default note
