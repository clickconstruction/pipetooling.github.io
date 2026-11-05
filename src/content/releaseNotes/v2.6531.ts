import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6531',
  date: '2026-11-04',
  title: 'A dev can import the days the app never recorded from the person’s desk',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Under Hours on a person’s desk, Import days… takes one day a line with the hours and where the day came from, on one job named by its number. Each day lands as an imported clock session that waits for approval like a punch.',
    'The answer says what went in, what was already there, and which lines were refused and why. Paste the same lines twice and the second time is skipped.',
    'The guide for charging by crew says how.',
  ],
}

export default note
