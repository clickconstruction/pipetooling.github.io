import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7710',
  date: '2026-11-17',
  title: 'App updates: a page that fails to load waits for a save before it reloads',
  kind: 'fix',
  highlights: [
    'Right after an update a page can fail to load its files, and the app reloads itself once to fix it.',
    'That reload now waits for anything still saving, so the save is not cut off part way.',
    'You see Updating app… while it waits. It never waits longer than half a minute.',
  ],
}

export default note
