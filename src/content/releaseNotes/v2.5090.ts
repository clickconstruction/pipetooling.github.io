import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5090',
  date: '2026-10-09',
  title: 'Robots: the kickoffs and /bid carry the $0.70-a-mile travel rule',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The robot estimator’s kickoffs and the /bid runbook now price travel the owner’s way: one row at $0.70 a mile, round trip, once per job day. They still said the old $80 a mile or 10% of the building.',
    'The Console’s copy buttons carry the new rule with this release. Set up on this Mac carries it once the twin-setup function is redeployed.',
  ],
}

export default note
