import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4292',
  date: '2026-10-01',
  title: 'Submittals from the takeoff: the product is the fixture’s parts, not one line',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'Choose from the takeoff used to name one part as each fixture’s product, and sometimes the wrong one: an angle stop for a lavatory, a flush valve for a water closet. Now the product is the fixture’s parts, joined in the order they sit on the takeoff: the bowl, the flush valve, the seat, the carrier.',
    'Stops, supplies, P-traps, flanges and grid drains start switched off. Each part shows as a chip under the fixture. Tap one to switch it on or off. Your choice is remembered with your tick.',
    'Rows already built keep the product they were built with. Edit changes any of them.',
  ],
}

export default note
