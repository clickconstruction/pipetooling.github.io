import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6147',
  date: '2026-10-30',
  title: 'Each Quickfill station’s rhythm as a two-week strip (punch list #217, office-8, a prototype)',
  kind: 'feature',
  highlights: [
    'On the Roller’s Board and the phone’s round list, a new press, Show the strips, draws each station as a row of the last two weeks: a dot on every day it was looked at, a dashed line where the next look falls due, red past that line, today outlined.',
    'With the strips on, the phone head’s counts become chips. Press due, due today, not yet or fresh to see only those stations.',
    'The press is remembered for you on this device and is off until you turn it on, so nothing changes for anyone else.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
