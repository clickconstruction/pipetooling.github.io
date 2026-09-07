import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3060',
  date: '2026-09-07',
  title: 'Job windows read sub sheets by their job link',
  kind: 'fix',
  highlights: [
    'The Edit Job sub-labor cost box, the Job Detail profit band, the job charges timeline, work-order coverage and the sheet story now find a job’s sub sheets by the link on the sheet, not by comparing job numbers as text.',
    'The Edit Job cost box no longer reads every sheet in the company to find the ones on this job.',
    'Offering the next stage to a GC after an inspection passes follows the sheet’s job link too.',
  ],
}

export default note
