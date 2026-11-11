import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6893',
  date: '2026-11-10',
  title: 'Permits: the tab’s lists load in about half the time',
  kind: 'fix',
  highlights: [
    'Prospects → Permits loads faster. The skim, Kept and Closed took two to three seconds and now take about one. Builders took three and now takes under one.',
    'Nothing on the tab reads differently. The same permits, plumbers and counts come back, checked row for row in all five cities.',
    'A second change that removes most of the wait that is left is on its way. The Read back press on Builders stays switched off until then.',
    'In a bid, the reason under a name question no longer ends in two full stops after a customer whose name ends in one.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
