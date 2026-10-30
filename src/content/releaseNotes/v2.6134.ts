import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6134',
  date: '2026-10-30',
  title: 'Job Parts Tally on a desk is back to its width',
  kind: 'fix',
  roles: ['subcontractor', 'helpers', 'superintendent', 'master_technician', 'primary', 'dev', 'assistant', 'controller', 'estimator'],
  highlights: [
    'v2.6117, which stopped the page growing and shrinking between its tabs, also drew the page 32 px wider on a desk than it had been. It is back to its width: 480 px, or 760 px for the office’s Team queue on Transactions.',
    'A phone sees no difference; the page fills the screen there either way.',
  ],
}

export default note
