import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2827',
  date: '2026-09-05',
  title: 'The crew lane in Team review',
  kind: 'feature',
  highlights: [
    'Prospects → Team → Review → Reflect now shows a Crew line on each person: what their teammates said on Ability, Drive, and Integrity, averaged, with how many rated. Never a name.',
    'The crew line appears once two teammates have rated someone, so a single rating stays private.',
    'Devs can let the crew lane count as one more reviewer in the composite and leaderboard from the gear on the Leaderboard tab. It is off until switched on.',
  ],
}

export default note
