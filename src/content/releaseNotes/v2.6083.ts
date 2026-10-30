import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6083',
  date: '2026-10-29',
  title: 'Phone first: the camera-first report, with every photo shrunk and filed in Drive',
  kind: 'feature',
  highlights: [
    'Leave report on a phone opens the camera first. The shot comes back to the form as a tile, Take another opens the camera again, and Cancel leaves the form with Take a photo as the first tile.',
    'The phone shrinks each shot before it leaves. The tile shows the before and after, like 4.2 MB → 310 KB. The office picks Small, Medium or Large once on Settings → Jobs & billing → Photos.',
    'A chip under a new tile asks which stage the photo shows, and the photo sits on that stage’s row. Every stage row has its own camera. Save names what it writes: Save · job 36% · 2 photos.',
    'Within a few minutes each photo is filed in the job’s Photos folder under the customer’s Drive folder, named by the day, the tech and the stage. The report card shows the photos, in Drive or not in Drive yet.',
  ],
  roles: ['subcontractor', 'helpers', 'superintendent', 'master_technician', 'primary', 'assistant', 'controller', 'dev'],
}

export default note
