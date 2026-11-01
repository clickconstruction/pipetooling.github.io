import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6273',
  date: '2026-11-01',
  title: 'The photo count on a report row stays put',
  kind: 'fix',
  highlights: [
    'The 📷 badge on the Reports tab’s cards, the Dashboard’s Recent reports and the job thread was lost when the list re-ordered itself while the counts were still loading. The count is kept now, whatever the list does meanwhile.',
  ],
  roles: ['assistant', 'controller', 'master_technician', 'dev', 'estimator', 'superintendent', 'primary'],
}

export default note
