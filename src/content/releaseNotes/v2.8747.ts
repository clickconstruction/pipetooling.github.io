import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8747',
  date: '2026-11-27',
  title: 'Trade partners: one rule says whether a company can leave the bench',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Remove from the bench… could show on a company the app would then refuse to remove. The list checked eight kinds of history and the remove checked eleven.',
    'The database now holds the rule once. The remove reads it, and the list can read the same answer for every company.',
    'Nothing on the screen changes yet. The press moves to that one rule in a later step.',
    'The remove refuses the same companies as before, in the same words.',
  ],
}

export default note
