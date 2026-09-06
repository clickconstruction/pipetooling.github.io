import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2898',
  date: '2026-09-05',
  title: '"The week" means one thing per family',
  kind: 'fix',
  highlights: [
    'The Weekly Money Movement report now opens on the same week Moneyfill closes — the previous complete Monday–Sunday week — instead of the week still in progress. The header says "close week" or "still running" so you always know which one you are looking at.',
    'On Moneyfill, the Bank transfers section says plainly that its list covers the last 90 days while the header chip counts only the close week, with both numbers side by side.',
    'Quickfill\'s money stations — People Hours, Unassigned field time, Banking sorting, Supply Houses — carry a "Close week: $N open" chip beside the daily mark, from the same counts Moneyfill shows. A green mark means checked today, not the week closed; the chip opens Moneyfill on that week for controllers, and is a plain label for everyone else.',
    'A prospect card whose last call is older than its section now shows both clocks — "didn\'t answer 187d ago · noted 12d ago" — and the section labels say which clock they use ("any touch in the last 30 days").',
  ],
}

export default note
