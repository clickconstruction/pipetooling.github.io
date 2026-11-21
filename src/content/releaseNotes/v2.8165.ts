import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8165',
  date: '2026-11-21',
  title: 'Trips: an agent’s plan for a joined trip now says the trip stays joined',
  kind: 'fix',
  highlights: [
    'When an agent plans a trip that was joined into another, the plan now says the save would be refused. Before, the plan said the trip would be added, and the save was then refused.',
    'The plan uses the same words the save is refused with. They name both trips and say the join is taken back with Split in two.',
    'Nothing changes on the Development page. A joined trip could not come back before this, and it cannot now.',
  ],
}

export default note
