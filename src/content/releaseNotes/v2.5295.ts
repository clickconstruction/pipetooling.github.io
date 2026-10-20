import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5295',
  date: '2026-10-12',
  title: 'Bill day: see what the trades sent before our bill goes',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'On Money, the Bill day card has a From the trades side. It shows each trade’s draw on a job against the bill day.',
    'A bar shows the draws by where they stand, flowing into what we bill the owner. A ring counts the seven gates, and Today lists the first three still open.',
    'Each ask to a trade is its own text with their portal link, drafted on a phone or copied on a desk.',
    'Open the lines on a draw to see what the superintendent saw and its money at what we see. Approve and send back stay in Draws.',
  ],
}

export default note
