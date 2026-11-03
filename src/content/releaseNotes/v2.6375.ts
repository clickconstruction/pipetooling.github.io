import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6375',
  date: '2026-11-02',
  title: 'A photo keeps the time the camera fired, not the time it reached the app',
  kind: 'fix',
  highlights: [
    'A report photo, a Tally box photo or a checklist photo now takes its time from the file itself, the moment the camera fired. A shot kept on a phone with no signal and sent the next morning sits on the day it was taken, in a site’s History, on Documents → Photos and in the Drive file’s name.',
    'A file with no date, or a date that cannot be right, keeps the time it reached the app as before.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'helpers'],
}

export default note
