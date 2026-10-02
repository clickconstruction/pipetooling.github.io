import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4389',
  date: '2026-10-01',
  title: 'Takeoffs: every bid prices its materials one way',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The By Stage and Combined buttons are gone from Takeoffs and Labor. Every bid now works the way Combined did.',
    'You stage materials with the 1 · 2 · 3 boxes under each fixture, as before.',
    'An old bid that was set to By Stage now opens on its parts list. If it has no parts yet, Takeoffs says which fixtures have no cost.',
    'Purchase orders are no longer made from a takeoff. Use Job Parts Tally or PO Builder.',
  ],
}

export default note
