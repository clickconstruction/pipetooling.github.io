import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4487',
  date: '2026-10-04',
  title: 'AIA G702-G703: see the paper as you fill it, and nothing left from another job',
  kind: 'fix',
  highlights: [
    'The AIA G702-G703 window now shows both pages on the left while you fill the form on the right. The nine lines and the retainage work themselves out as you type.',
    'Press a box on the paper and the cursor lands in its field. On a narrow screen, Form and Preview swap the two sides.',
    'A field you leave empty is now empty in the download. Before, the workbook kept the numbers of the job it was first made for.',
    'The totals in the download are this job’s own, including in a phone’s mail preview, which used to show the old job’s totals.',
  ],
}

export default note
