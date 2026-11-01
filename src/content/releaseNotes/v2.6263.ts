import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6263',
  date: '2026-11-01',
  title: 'Edit report shows the photos and takes more',
  kind: 'feature',
  highlights: [
    'Edit report, under My Reports in Settings, now shows the report’s photos under the fields, as the report card does, and an Add a photo tile on a job’s report. A new shot is shrunk and sent like a field report’s, and Save reads Save · 1 photo added.',
    'A photo already on the report stays. The form says so. Take one back in the job’s Drive folder, which is where the photos live.',
  ],
  roles: ['subcontractor', 'helpers', 'superintendent', 'master_technician', 'primary', 'estimator', 'assistant', 'controller'],
}

export default note
