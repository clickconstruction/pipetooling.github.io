import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7002',
  date: '2026-11-12',
  title: 'First look: a photo that is in cannot be swapped by whoever holds the link',
  kind: 'fix',
  highlights: [
    'Once a customer\'s photo or video is in and checked, it is moved to a place of its own. A forwarded link can still add a file, and it can no longer replace one that is already in.',
  ],
}

export default note
