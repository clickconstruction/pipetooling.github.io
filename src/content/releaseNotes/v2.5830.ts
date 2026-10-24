import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5830',
  date: '2026-10-24',
  title: 'Quickfill: Focus no longer reloads its folded sections over and over',
  kind: 'fix',
  roles: ['assistant', 'controller', 'estimator', 'master_technician', 'dev'],
  highlights: [
    'In Focus, a section at zero folded to one line and then loaded itself again and again, hundreds of times a second. A tab left on Focus put a heavy load on the app’s database and could lose its sign-in.',
    'A folded section now loads once and stays folded. Open now shows it as it was, without loading it again.',
    'A section at zero that checks again keeps its line while it checks, so the page no longer jumps.',
  ],
}

export default note
