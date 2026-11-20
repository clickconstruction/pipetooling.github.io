import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8062',
  date: '2026-11-20',
  title: 'Document builder: a page put back leaves nothing to publish',
  kind: 'fix',
  highlights: [
    'On the Sub NDA, a topic’s name changed and then put back with Back to revision no longer leaves Publish live. The press reads Nothing to publish.',
    'So a revision the same as the last one can no longer be published by mistake, and the attorney’s read mark stays on.',
  ],
}

export default note
