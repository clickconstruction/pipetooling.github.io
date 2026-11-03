import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6453',
  date: '2026-11-03',
  title: 'Job photos keep the time the camera fired, and every photo form takes its shots the same way',
  kind: 'fix',
  highlights: [
    'A photo added in the Job photos window now keeps the time the camera took it, as a report’s photo has since v2.6375. A photo with no camera time keeps the file’s own time, as before.',
    'The report forms and the Job photos window now share one way of taking a shot: shrink it, send it, keep it on the phone with no signal, Retry and Remove. Nothing changes in how a report’s photos look or behave.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'helpers', 'subcontractor'],
}

export default note
