import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7600',
  date: '2026-11-17',
  title: 'App updates: the app looks again before it reloads itself',
  kind: 'fix',
  highlights: [
    'The app reloads itself onto a new version at a quiet moment. A press made in the second or two before the reload could be cut off, and its save never answered.',
    'The app now looks again at the moment it would reload. Something still saving is waited out first.',
    'If you touched the page, opened a window or put the cursor in a field by then, it does not reload. The pill asks instead.',
    'One tab taking the update no longer reloads your other open tabs under you. Each tab waits for its own quiet moment.',
  ],
}

export default note
