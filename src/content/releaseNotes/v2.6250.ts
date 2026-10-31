import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6250',
  date: '2026-10-31',
  title: 'Adopting a bid leaves a line on both bids\' logs',
  kind: 'feature',
  highlights: [
    'When you adopt a bid into a package as a version, the adopted bid\'s log now says who adopted it, into which bid, as which version, and what moved: count rows, price scenarios, plan sets and CountTooling projects.',
    'The package gets the matching line: which bid it adopted, as which version, and what arrived. The old bid left the board and still looks up by its number.',
    'Before this, an adopt left no line on either log, so a retired bid\'s own record never said where its counts went.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
