import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6090',
  date: '2026-10-29',
  title: 'A job’s Drive photos in the app (punch list #164, PR 5)',
  kind: 'feature',
  highlights: [
    'The job window shows the job’s photos under the address: Photos · 15 as the door to the folder’s viewer, three thumbnails and a + N tile, read from the customer’s Google Drive folder and never copied out of it.',
    'The viewer shows every picture in the folder, the newest first, each at full size on a press, with Open in Drive. A checklist photo appears among them once the sweep files it; until then the strip counts it as on its way.',
    'A job with no Drive folder link says so, with Set the folder for the office. This closes punch list #164.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', 'estimator', 'helpers', 'subcontractor'],
}

export default note
