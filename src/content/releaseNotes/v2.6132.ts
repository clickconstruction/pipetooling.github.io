import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6132',
  date: '2026-10-30',
  title: 'Leave Report: an untouched Save always files the job’s own percent',
  kind: 'fix',
  highlights: [
    'Leave Report opens its percent on the job’s recorded number. Leave it and press Save, and the report files that number every time, even a Save pressed the instant the form draws. A fast press could file 0 while the field read 40.',
    'On a phone the Save button’s own number reads the same rule, so it never promises a number Save would not file.',
  ],
}

export default note
