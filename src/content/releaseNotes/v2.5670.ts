import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5670',
  date: '2026-10-20',
  title: 'Dispatch’s Open the job is for the office, and the close note names a C# job',
  kind: 'fix',
  roles: ['estimator', 'dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'An estimator who is also in Dispatch no longer sees Open the job on a won bid’s to-do. It opened New Job, which an estimator cannot save. The draft still reads on the row.',
    'When a job has a C# but no HCP number, the to-do now closes with the job’s number, like “J1085 opened from B398”, instead of “A job opened”.',
  ],
}

export default note
