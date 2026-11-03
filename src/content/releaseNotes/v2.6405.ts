import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6405',
  date: '2026-11-02',
  title: 'The Pipeline search says when your filters hide a match',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A search that finds jobs behind a hidden group or a filter now says how many, right above the board. Before, it said No match anywhere.',
    'Show them puts those matches on the board until you clear the search. Your hidden groups and filters stay as you set them.',
    'An empty section now says when your filters are on, and No match anywhere only appears when nothing matched behind them either.',
  ],
}

export default note
