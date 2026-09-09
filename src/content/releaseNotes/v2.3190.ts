import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3190',
  date: '2026-09-09',
  title: 'Job Mode: the Clock In button works again when there is no schedule',
  kind: 'fix',
  highlights: [
    'On the Dashboard\'s Job Mode card, "No schedule for today — Use Clock In to choose a job manually" now does what it says: tapping Clock In opens the Clock In window so you can pick a job and clock in.',
    'Before, that tap did nothing. The button handed off to the Update Focus window, which only opens while you are already clocked in.',
    'Choose Next Job, Start First Job, Wrap Up Day and the visible clock button are unchanged.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'subcontractor', 'helpers', 'estimator', 'superintendent'],
}

export default note
