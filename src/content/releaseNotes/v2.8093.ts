import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8093',
  date: '2026-11-20',
  title: 'Before we start: a lost signal shows Retry in place of an empty tab',
  kind: 'fix',
  highlights: [
    'When the app cannot check a job on a weak signal, Before we start now says why and offers Retry.',
    'Before, the whole section was missing from the job’s Documents tab, with no reason.',
    'On a development, the Schedule look no longer leaves a job out without a word. It offers Retry.',
  ],
}

export default note
