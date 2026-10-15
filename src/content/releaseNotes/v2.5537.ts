import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5537',
  date: '2026-10-14',
  title: 'GC projects and Messages sit in the middle of a wide screen',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On a wide screen, GC projects and Messages hugged the left edge while the Bid Board sat in the middle. Both pages now sit in the middle like the Bid Board.',
    'Nothing else on either page moved. On a phone they fill the screen as before.',
  ],
}

export default note
