import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6444',
  date: '2026-11-03',
  title: 'The missed-call test no longer fails a change in the minute before midnight',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A test of the text back after a missed call read the real time. Its office hours closed at 11:59 PM, so for one minute a night it expected the daytime text and got the evening one.',
    'On November 3 the merge queue ran it at 11:59:45 PM Central and turned away a good pull request.',
    'The test now sets its own clock to the Friday afternoon its calls describe. It passes at any time of day, which was checked at 11:59 PM, midnight and noon.',
  ],
}

export default note
