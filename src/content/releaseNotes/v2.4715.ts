import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4715',
  date: '2026-10-06',
  title: 'AIA G702-G703: a deleted application stays in the history',
  kind: 'feature',
  highlights: [
    'Delete now takes an application off the job without losing it: the history lists it after the live ones as a quiet line, with who deleted it and when.',
    'Its workbooks stay with it, so you can still download what went out. Its number is free for a new application.',
    'The job’s Documents tab shows the same line.',
  ],
}

export default note
