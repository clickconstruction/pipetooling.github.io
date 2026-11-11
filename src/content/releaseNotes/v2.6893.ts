import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6893',
  date: '2026-11-10',
  title: 'Permits: the tab’s lists load at once, and Read back is on again',
  kind: 'fix',
  highlights: [
    'Prospects → Permits loads at once. The skim, Kept, Closed and Builders each took two to three seconds this morning, and now take well under a tenth of one.',
    'Nothing on the tab reads differently. The same permits, plumbers and counts come back, checked row for row in all five cities.',
    'The Read back press is on Builders again, beside the line that says where San Antonio’s records start. Each press reads about three more months.',
    'In a bid, the reason under a name question no longer ends in two full stops after a customer whose name ends in one.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
