import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6265',
  date: '2026-11-01',
  title: 'A report with photos waits on the phone',
  kind: 'feature',
  highlights: [
    'With no signal, a photo you take for a report is kept on the phone. Its tile reads Kept on the phone. It goes with the report. Save never waits: the report and its photos go into the queue together, and the line at the top reads Field report from 7:58 AM · waiting to send · 1 photo with it.',
    'When the signal is back the phone sends the photos first, then the report, then ties them together. The report card shows the photos as if they had gone at once. Nothing you pressed is lost.',
    'A photo that fails for another reason still shows why, with Retry.',
  ],
  roles: ['subcontractor', 'helpers', 'superintendent', 'master_technician', 'primary', 'estimator', 'assistant', 'controller'],
}

export default note
