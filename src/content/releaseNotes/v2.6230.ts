import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6230',
  date: '2026-10-31',
  title: 'Adopting a bid as a version brings its plan sets and CountTooling projects along',
  kind: 'feature',
  highlights: [
    'When you adopt another bid as a version, its CountTooling projects and its plan sets come with it, as that version\'s own. Before, they stayed behind on the retired bid.',
    'In Edit Bid, a set or a project that came this way wears the version\'s name. Each plan set\'s memo says which bid it came from.',
    'So two estimators who bid the same job as separate bids can live side by side as versions, each with his own counts, prices and the plans he bid from.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
