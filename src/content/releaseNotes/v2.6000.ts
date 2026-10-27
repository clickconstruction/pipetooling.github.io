import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6000',
  date: '2026-10-27',
  title: 'Pricing: an alternate with its own takeoff stays on screen when you open it',
  kind: 'fix',
  roles: ['estimator', 'assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'On Bids → Pricing, clicking an alternate\'s 📐 own takeoff card opens that alternate on the Workbench. Before, the card vanished and the row showed one price card carrying the base\'s price name, so the alternate looked gone. Now a line at the top of the cards says "You are on INCLUDING WATER SOFTENER, an alternate with its own takeoff", and the base rides the row as the first card. One click on it takes you back.',
    'Every version card says Open ›, so a card that moves you onto another version looks different from a price card you click to view.',
    'Wendi recorded it on 2026-10-27 on BP545: she clicked INCLUDING WATER SOFTENER twice and it disappeared twice. Nothing she typed was lost. The app had moved her onto the alternate without saying so.',
  ],
}

export default note
