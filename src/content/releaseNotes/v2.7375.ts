import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7375',
  date: '2026-11-15',
  title: 'The crew’s job window reads the job before the first clock-in',
  kind: 'fix',
  highlights: [
    'A helper, a superintendent or an estimator put on a job’s crew now sees the customer’s name and number, the job’s status and its plans as soon as they open the job.',
    'Before, those parts stayed empty until that person had clocked in on the job once, and Plans said “Could not read the job”.',
    'Nothing changes for the office or for a subcontractor, who already read their jobs.',
  ],
}

export default note
