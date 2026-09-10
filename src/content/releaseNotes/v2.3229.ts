import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3229',
  date: '2026-09-10',
  title: 'Robots: a fixed plan set is picked up by the next batch on its own',
  kind: 'feature',
  highlights: [
    'When you fix a bid\'s plan set and tap Attached — rerun on the robot needs sheet, the next robot batch now picks that bid back up by itself and re-reads the new plans. Nothing else to do.',
  ],
}

export default note
