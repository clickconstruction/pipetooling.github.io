import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4358',
  date: '2026-10-02',
  title: 'Submittals: What the GC sees opens in a window',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'See what the GC sees now opens the GC’s page in a window over the Submittals page, instead of a panel that squeezed the rows to one side.',
    'Close it with the ×, the Esc key or a click outside. The enlarge button fills the screen. On a phone it fills the screen as before.',
  ],
}

export default note
