import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6604',
  date: '2026-11-06',
  title: 'The crew reads the plans of the job they are on',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'subcontractor', 'helpers'],
  highlights: [
    'A subcontractor or a helper on a job that sits inside a development can now read the plans their job builds from, and keep an as-built there. Before, the database showed them no set on such a job.',
    'Nothing else opens: the crew still reads no development, changes no set but their own as-built, and sees no plans of a job they are not on.',
    'Their own job window does not yet draw the Plans section with Add our as-built; that press is on the office window today. Putting it on the crew screen is its own item.',
  ],
}

export default note
