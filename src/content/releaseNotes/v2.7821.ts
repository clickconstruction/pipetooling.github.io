import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7821',
  date: '2026-11-18',
  title: 'Pay: the dev seat changes the pay setup of a person who exists',
  kind: 'feature',
  highlights: [
    'A dev’s agent can now change a person’s wage, Salaried, employment dates and workday start. It shows a plan first, and nothing is saved until the plan is approved.',
    'The plan says what the change reaches back into. It counts the weeks with no pay report and the past crew days that job labor will price again.',
    'A change made this way leaves a line on the pay log with the before, the after and the reason.',
    'A salaried day is 8 hours in the app. The agent refuses a day of any other length and stores nothing.',
  ],
}

export default note
