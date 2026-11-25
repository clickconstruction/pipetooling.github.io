import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8552',
  date: '2026-11-24',
  title: 'Accounts Receivable: after a case is closed, the next case opens',
  kind: 'fix',
  highlights: [
    'When you close a case under Came back, the next case opens in the pane.',
    'Before, the pane picked the first row of the list by itself. That could be a deposit with Apply live, one stray press away.',
    'When no case is left, nothing is picked. Press a deposit to open it.',
    'It is the same after Put the bill back, and after a case is closed by its new check.',
  ],
}

export default note
