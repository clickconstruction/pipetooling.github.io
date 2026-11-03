import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6425',
  date: '2026-11-03',
  title: 'Days the app never recorded can be put on the clock',
  kind: 'feature',
  roles: ['dev', 'controller'],
  highlights: [
    'A dev can import a worker’s days from before the clock began, one row a day, each naming where the day came from.',
    'Imported days wait for approval like any punch. Once approved, the pay, the hours statement, the Costs tab and the scoreboard read them.',
    'Running the same import twice adds nothing: one imported row a person, a day and a job.',
  ],
}

export default note
