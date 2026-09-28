import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3921',
  date: '2026-09-27',
  title: 'Workflow: how dates, day counts and money are printed has tests',
  kind: 'fix',
  highlights: [
    'The small rules behind a stage card — the date and time on an action, “3 days” open, the expected-date pill that turns amber or red, money with a negative in parentheses, the colour of a step’s name — lived inside the Workflow page with no test. They now live in small modules with forty-one.',
    'Counting the days between two expected dates is one shared rule, tested across month ends, leap days and the daylight-saving weekends.',
    'Nothing on screen changes.',
  ],
}

export default note
