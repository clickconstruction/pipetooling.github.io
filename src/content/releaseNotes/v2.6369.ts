import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6369',
  date: '2026-11-02',
  title: 'Find a file shows our index’s hits at once, and Drive’s search fills in behind them',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Find a file waited for Drive’s search before it showed anything, so the index’s answer took seconds. The index’s hits now show as soon as they come, usually within a second.',
    'A quiet line says Drive’s search is still looking. Its finds that the index did not name join the list when it answers.',
  ],
}

export default note
