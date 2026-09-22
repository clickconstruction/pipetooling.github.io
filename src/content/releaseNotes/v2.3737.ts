import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3737',
  date: '2026-09-22',
  title: 'Schedule hub: the sample and twin accounts are off the roster',
  kind: 'fix',
  highlights: [
    'The Schedule hub’s Day and People boards listed the View-as sample accounts (“Sample leader”, “Sample assistant”, …) and the digital twins (“Twin Estimator 1”, …) as people you could schedule. They are hidden now, the same rule the People rosters already follow.',
    'The same roster feeds Dispatch Mode’s Schedule tab, the Quick assign sheet and Quickfill Schedule, so those hide them too.',
  ],
}

export default note
