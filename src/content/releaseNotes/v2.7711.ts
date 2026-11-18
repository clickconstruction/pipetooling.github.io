import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7711',
  date: '2026-11-17',
  title: 'Lien desk: the timeline’s Last work agrees with Months on this job',
  kind: 'fix',
  highlights: [
    'On a job with no clock hours, the timeline could name a different last month than the line in Months on this job. It took the month an older notice named. Now both name the same month.',
    'The affidavit’s last day and the year to sue on the timeline count from that month too, as the rest of the desk counts them.',
    'A day set by hand still dates the job. A notice that already went out stays on the timeline as its own stop.',
  ],
}

export default note
