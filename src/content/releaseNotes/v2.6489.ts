import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6489',
  date: '2026-11-04',
  title: 'The Scoreboard reads every crew row, On its way counts a job photo, and an On paper send leaves its thread line',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The Development page’s Scoreboard reads every crew day of a job, so a job past 1,000 person-days shows all of its Hours, Days, Labor, Cost and Profit.',
    'The job window’s photo strip and its Documents tab count a photo added in the Job photos window, and a report’s photo, as on its way to the folder until the sweep files it.',
    'Sending a warranty or a contract on paper leaves the same line on the customer’s thread as sending the signing link does.',
  ],
}

export default note
