import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2195',
  date: '2026-08-23',
  title: 'Add-task window: your draft survives a slow load',
  kind: 'fix',
  highlights: [
    'The Add Task window reset its whole form whenever the people list finished loading — on a slow connection that could wipe a title you were already typing. It now resets only when it opens (or opens with a new preset).',
    'This was also the flaky test that intermittently blocked unrelated merges in CI.',
  ],
}

export default note
