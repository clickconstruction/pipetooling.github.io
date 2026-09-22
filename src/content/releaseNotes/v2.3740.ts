import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3740',
  date: '2026-09-22',
  title: 'The app updates itself at quiet moments',
  kind: 'feature',
  highlights: [
    'When a new version is out, the app now reloads onto it by itself instead of only asking — at the moment you first open a page and have not touched anything yet, or when you move to another page with nothing open. A brief "Updating to the newest version…" pill shows while it happens.',
    'It never reloads on its own while a window is open or a field has the cursor in it, and it leaves you alone for ten minutes after you tap Not now. When it cannot find a quiet moment, the "A new version is ready" pill asks as before.',
    'Customers opening an estimate, contract or bid link get the current version on that first open, instead of a copy their phone cached weeks ago.',
  ],
}

export default note
