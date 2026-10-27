import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5933',
  date: '2026-10-26',
  title: 'Every role gets the search box, with the doors its role can open',
  kind: 'feature',
  roles: ['estimator', 'primary', 'superintendent', 'subcontractor', 'helpers'],
  highlights: [
    'Estimators, primaries and superintendents now have the magnifier in the header, and ⌘K or Ctrl+K opens it. Type a page, a tab, a Settings card or a task, and the box lists the ones your role can open.',
    'That box has no job, bid or customer rows. A number alone finds nothing there. Bids, jobs and customers keep their own search on their own pages.',
    'Helpers and subs keep their job lookup. A question in the same box now lists the guides for your role under your jobs.',
  ],
}

export default note
