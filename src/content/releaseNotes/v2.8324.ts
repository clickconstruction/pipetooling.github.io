import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8324',
  date: '2026-11-23',
  title: 'Customers: a merge carries everything linked to the other customer',
  kind: 'fix',
  highlights: [
    'Merging two customers now moves everything linked to the one that goes. Before, only bids, jobs, estimates, projects and contacts moved, and properties, portal links, ratings, files and a job’s GC were lost.',
    'Before you merge, the window lists what moves, and what happens where a customer can hold a thing only once, like a portal address.',
    'Anything a merge drops is kept in the deleted records, where a dev can bring it back.',
    'Two customers that each have a legal matter are not merged until a dev joins the two matters.',
  ],
}

export default note
