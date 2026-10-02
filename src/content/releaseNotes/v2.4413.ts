import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4413',
  date: '2026-10-02',
  title: 'Bids: a copy of a bid takes one version, its own prices and its quoted costs',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Duplicating a bid that has versions now copies the version you are on. Before, every version went into the copy and the counts doubled.',
    'A copy now gets its own copy of the bid\'s prices. Before, it kept pointing at the first bid\'s prices and its Pricing tab came up empty.',
    'Costs you applied from a supply house quote now follow a new version, a same-trade duplicate and an adopted bid.',
    'A new guide explains it: copy a bid into another trade or duplicate it.',
  ],
}

export default note
