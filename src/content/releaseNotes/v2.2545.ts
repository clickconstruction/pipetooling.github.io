import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2545',
  date: '2026-09-01',
  kind: 'infra',
  title: 'Robots grade old bids before practicing on them',
  highlights: [
    'Historical bids are graded A–X by how completely they were recorded; only well-recorded, trustworthy references count toward a robot’s promotion score.',
    'When a robot’s careful estimate disagrees with a sparse old record, the audit can now rule the old record wrong — filing a repair task so the history gets fixed instead of mis-teaching the robot.',
  ],
}

export default note
