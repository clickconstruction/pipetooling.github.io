import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6738',
  date: '2026-11-08',
  title: 'A stage checklist shows a report photo before the pick',
  kind: 'fix',
  roles: ['helpers', 'subcontractor', 'master_technician', 'superintendent', 'primary', 'assistant', 'dev'],
  highlights: [
    'When a photo from a field report answers a checklist question, the sheet now shows that photo under the question right away, with Taken on a field report, before anyone presses Yes, No or Not here.',
    'A closed row whose photo came from a report reads photo taken on a field report instead of asks for a photo, so nobody takes the shot twice.',
    'Found on the live run of the camera report on a test job: the sheet used to hide the photo until the pick, and on a one-question stage the pick filed the checklist at once, so the photo was never seen on the sheet.',
  ],
}

export default note
