import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6609',
  date: '2026-11-06',
  title: 'Add our as-built on the crew’s own job window',
  kind: 'feature',
  roles: ['subcontractor', 'helpers', 'estimator', 'superintendent', 'dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A helper or a subcontractor who opens a job from the Dashboard or Job Mode now sees the Plans section under the job’s status: Building from with Open, Our as-builts, and Add our as-built with photos or a PDF. Before, their window had one Open plans row and the press was on the office window alone.',
    'The office’s + New set stays on the office window; the crew adds and changes only their own as-builts, as the database already held.',
    'A job with no set of plans still shows Open plans when the job carries a pasted link.',
  ],
}

export default note
