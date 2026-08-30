import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2517',
  date: '2026-08-30',
  title: 'Audits tab: review robot bids in one place',
  kind: 'feature',
  highlights: [
    'A new Audits tab appears on the Bids page whenever a robot bid is waiting on a human audit — the tab label carries the pending count.',
    'Each card has one-click links that open the robot’s CountTooling takeoff and the PipeTooling bid in new tabs, the robot’s questions with inline answer boxes, and note boxes for counts, footage, pricing, scope, and general feedback.',
    'Finish audit hands your notes to the robot; it replies under each one with a receipt showing what it learned.',
  ],
}

export default note
