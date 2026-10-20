import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5567',
  date: '2026-10-15',
  title: 'Dashboard: a Training card under My Time, in one colour',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers'],
  highlights: [
    'A Training card at the bottom of the Dashboard, under My Time, lists the courses your role must take. One line at the top says where you stand: red for a course to do, amber for one to take again, green when you are caught up.',
    'Each course has one press: Start, Continue, Take it again, or Read it again. It opens the course where you left off.',
    'The card shows only when a course is on and required for your role. A caught-up crew member sees one quiet green line and nothing more.',
  ],
}

export default note
