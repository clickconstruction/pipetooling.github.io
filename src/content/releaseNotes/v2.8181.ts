import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8181',
  date: '2026-11-21',
  title: 'Permits: the warm, cold or new name word counts the same bids as Market',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The word under who pulled a permit now counts our bids of the last two years, and a robot’s practice bid is not one of them.',
    'A name Market calls Never bid now reads new name on the skim card too. Before, an old bid or a practice bid could make it read cold.',
    'Hovering new name now says no bid to this name in the last two years.',
  ],
}

export default note
