import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2941',
  date: '2026-09-06',
  title: 'Robot audits: standing rulings, and the queue sorts by what you unblock',
  kind: 'feature',
  highlights: [
    'A Standing rulings panel now sits atop the Audits tab: every question the robots have parked, with duplicates on the same issue collapsed into one card — answer once and it lands on every copy, on every bid.',
    'Until now those questions only appeared in a developer console, so they waited days; fifteen minutes in this panel unblocks every robot at once.',
    'Pending audit cards now sort by what your verdict unblocks — open questions first, then how far the robot landed from our number — instead of oldest first.',
  ],
}

export default note
