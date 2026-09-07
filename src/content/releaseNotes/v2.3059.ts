import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3059',
  date: '2026-09-07',
  title: 'Sub labor cost rollups use the sheet’s job link',
  kind: 'fix',
  highlights: [
    'The paid-job email, Billed aging costs, paid profit stats, the partner profit share and the weekly money email now find a job’s sub sheets by the link on the sheet, not by comparing job numbers as text.',
    'The weekly money email used to match numbers case-sensitively and pick the oldest job when a number was reused; it now agrees with the other reports.',
    'Settling a work order on a one-job project links the sheet it creates to that job, click-number jobs included.',
  ],
}

export default note
