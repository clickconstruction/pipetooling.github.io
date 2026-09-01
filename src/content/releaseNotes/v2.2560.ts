import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2560',
  date: '2026-08-31',
  title: 'A scoreboard for robot estimator confidence',
  kind: 'feature',
  highlights: [
    'New dev-only Scoreboard lens in the Robots group: each work category shows its last five practice runs against the ±8% accuracy bar — the exact rule that decides when the robot earns more autonomy.',
    'Runs in flight appear as dashed slots that fill in as they score, thrown-out runs stay visible struck-through, and the audit backlog is flagged as the bottleneck it is.',
  ],
}

export default note
