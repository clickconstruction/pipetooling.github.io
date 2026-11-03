import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6395',
  date: '2026-11-02',
  title: 'The merge queue builds six at a time and a docs-only change skips the full test run',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'On November 2 the queue held 23 pull requests with a three-hour wait at the tail: it built three at a time, each build took about 25 minutes, and 23 of 99 queue builds failed on a test and sent entries back to the end.',
    'The queue now builds six at a time and merges on the head build being green, so one flaky build no longer ejects its pull request and rebuilds the ones behind it.',
    'A pull request that touches only docs, to-dos, a root note or a release note runs the five tests that read those files instead of the whole suite, about five minutes instead of twenty-five. One code file brings the whole suite back.',
  ],
}

export default note
