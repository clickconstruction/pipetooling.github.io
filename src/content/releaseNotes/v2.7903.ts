import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7903',
  date: '2026-11-19',
  title: 'Robots: a new robot’s kickoff says its own name',
  kind: 'fix',
  highlights: [
    'Setting up a Mac for a robot hands back a kickoff that names that robot. Before, every kickoff said twin-estimator-1.',
    'A Mac set up for Twin Estimator 4 now opens its session as twin-estimator-4. The rounds and the pricing robot follow the same rule.',
    'The Copy kickoff buttons on the Console are unchanged.',
  ],
}

export default note
