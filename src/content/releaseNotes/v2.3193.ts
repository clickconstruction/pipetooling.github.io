import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3193',
  date: '2026-09-09',
  title: 'Job Mode: the Clock In button is orange, like the clock button everywhere else',
  kind: 'feature',
  highlights: [
    'On the Job Mode card, the Clock In button under "No schedule for today" is now the same orange as the app\'s clock button and the Clock In window it opens.',
    'Start First Job, Next Job and Switch to Scheduled Job stay green: green moves you along a schedule you already have, orange starts the clock.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'subcontractor', 'helpers', 'estimator', 'superintendent'],
}

export default note
