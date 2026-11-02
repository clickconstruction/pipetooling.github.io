import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6352',
  date: '2026-11-02',
  title: 'Projects on the leader’s Dashboard: one line under Money in, open to the board’s cards (punch list #242, PR 6)',
  kind: 'feature',
  roles: ['dev', 'master_technician'],
  highlights: [
    'The leader’s Dashboard has a Projects line under Money in, the same size and shape. Closed, it counts the working projects, how many are behind and ahead, and names the worst one.',
    'Press the line and it opens to the same cards as the Projects board, with the strip, the slider and the reason. Close ▴ folds it back to one line, and the Dashboard remembers the choice.',
    'Open the board → on the open strip goes to the full page.',
  ],
}

export default note
