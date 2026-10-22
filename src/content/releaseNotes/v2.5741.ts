import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5741',
  date: '2026-10-22',
  title: 'Settings: retire a robot from the fleet',
  kind: 'feature',
  highlights: [
    'Each robot’s row on Settings → System → Digital twins & samples has a quiet Archive at its end. It asks first, revokes the robot’s live keys so no Mac can keep running it, and keeps its runs and bids.',
    'An archived robot moves to a small “archived” line under the fleet. Open it and press Restore to bring one back, with no key until you issue one.',
    'Minting a new robot never reuses an archived one’s seat.',
  ],
}

export default note
