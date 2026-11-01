import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6255',
  date: '2026-11-01',
  title: 'The New report form takes photos',
  kind: 'feature',
  highlights: [
    'Jobs → Reports → New report, the Stages tab’s row report and the Dashboard’s Job Report square now take photos on a job, the same way Leave report does: an Add a photo tile under the report type, the shot shrunk to the office’s size, a chip to say which stage it shows, and a camera on each stage row.',
    'Save names what it writes, as in Save report · 2 photos, and waits while a shot is still on its way. The saved report’s Stage progress line counts the photos, the report card shows them, and the sweep files them in the customer’s Drive folder within a few minutes.',
    'A report on a project or a bid takes no photo yet and says so. Copy to Text names the photos that went with the report.',
  ],
  roles: ['assistant', 'controller', 'master_technician', 'dev', 'estimator', 'superintendent', 'primary', 'helpers', 'subcontractor'],
}

export default note
