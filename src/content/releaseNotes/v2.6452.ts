import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6452',
  date: '2026-11-03',
  title: 'Edge drift check: a change counts from when it landed, so a deploy made while its pull request waited in the queue is named',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The check that says which deployed functions run older code than main timed each change by when the merge queue built it, not by when it landed. A function deployed in between read as current while it lacked the change.',
    'Each change built within a day before a deploy is now timed by when its pull request merged, asked of GitHub. When GitHub cannot be asked, those changes are read as just landed, so every function they touch is downloaded and compared instead.',
    'The first run named five customer signing functions that had run without the signed hours statement words since the morning. The check names when a change was built, when it landed and when the function was deployed, so the gap reads at a glance.',
  ],
}

export default note
