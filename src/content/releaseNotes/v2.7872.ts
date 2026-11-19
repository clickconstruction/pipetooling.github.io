import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7872',
  date: '2026-11-18',
  title: 'Pay: the dev seat’s plan names both days the salary sync fills',
  kind: 'fix',
  highlights: [
    'When a person is made Salaried, the app fills salary sessions for today and for the day before. The agent’s plan now says so.',
    'The plan names the day before when it falls before the person’s start date, since a session can appear there.',
    'Turning Salaried off clears the unapproved sessions of both days. The plan and the result now say that too.',
  ],
}

export default note
