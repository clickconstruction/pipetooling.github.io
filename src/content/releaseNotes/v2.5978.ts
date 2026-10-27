import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5978',
  date: '2026-10-27',
  title: 'Build on the Bridge and Stale open read an evening as that day',
  kind: 'fix',
  highlights: [
    'Build on the Bridge reads a percent or a field report sent after 7 PM as that day’s. Tonight’s progress counts today.',
    'A job made in the evening counts as sold that day. The window’s first day starts at midnight, not at 7 PM the night before.',
    'Stale open on Job Summary counts a job with no field day from the day it was made.',
    'Behind the scenes, new checks hold an evening to its own day on Collect, job follow-ups, and Market and Sales.',
  ],
}

export default note
