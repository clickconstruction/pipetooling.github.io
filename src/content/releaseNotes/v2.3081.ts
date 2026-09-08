import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3081',
  date: '2026-09-08',
  title: 'Sheet form: the Job field and the work-order panel read the job link',
  kind: 'fix',
  highlights: [
    'Opening a sub sheet to edit shows the job it is linked to in the Job field, and the work-order panel takes its trade from that job, instead of matching the typed number as text.',
  ],
}

export default note
