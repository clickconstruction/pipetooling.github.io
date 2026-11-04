import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6494',
  date: '2026-11-04',
  title: 'A check sent to Dispatch closes itself once the check is settled',
  kind: 'feature',
  highlights: [
    'A stage check the crew sent to Dispatch closes on its own when the check is answered on the sheet, skipped on this job or taken off. Nobody closes by hand what the row already settled.',
    'The closed request says how: Answered on the sheet by Luis Ortega · Yes, Skipped on this job by Sal Super with the reason, or Taken off by Sal Super. A company question taken off closes the check on every job.',
    'A note or a photo on the row settles nothing. The request stays with Dispatch until someone picks Yes, No or Not here.',
  ],
  roles: ['dev', 'assistant', 'estimator', 'master_technician', 'superintendent', 'primary', 'helpers', 'subcontractor'],
}

export default note
