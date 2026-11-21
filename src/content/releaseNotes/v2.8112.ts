import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8112',
  date: '2026-11-20',
  title: 'Permits, Market: the call list after the owner’s answers',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A name with a building word now leads Call this week: Construction, Contracting, Contractors or Builders. Any company name used to lead, and about half of San Antonio’s first twenty were design firms, or trades that hire no plumber. The other companies follow, and no name is removed.',
    'A job is counted once. San Antonio lists an application and its permit as two rows, and a project of several buildings as a row a building. One project could read as a dozen permits and make a name look like it was picking up. Each row now says jobs, not permits.',
    'A name you answered comes back only with a new job. After its 90 days or its year, it is offered again once it applies for a job. Until then it stays under Answered, where Put back still brings it back.',
  ],
}

export default note
