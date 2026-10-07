import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4749',
  date: '2026-10-07',
  title: 'Legal portal: the Lien grid reads better',
  kind: 'feature',
  highlights: [
    'Each job’s address now sits under its name and number, and the property reads Commercial or Residential, with Homestead or No homestead beneath.',
    'The unpaid total leads its column, with the unpaid months on the lines under it. A month whose § 53.056 window has closed is left off; a job with no window still open shows a dash.',
    'The GC picker is a rail beside the grid: every GC with its job count and open dollars, largest first, plus the jobs with no GC. Its numbers follow the Something due / All switch, and past ten GCs a find box filters the names.',
  ],
}

export default note
