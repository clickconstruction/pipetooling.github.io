import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6081',
  date: '2026-10-29',
  title: 'The Bid Costs tab’s Open, Won and Lost chips read',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On Bids → Bid Costs and the bid list window, a pursuit’s Open chip was pale ochre on its own tint, hard to read on the page. Open, Won and Lost now wear a deeper word of the same colour on the same tint, in both themes.',
    'Nothing else about the tab changed.',
  ],
}

export default note
