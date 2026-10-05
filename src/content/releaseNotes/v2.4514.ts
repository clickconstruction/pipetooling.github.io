import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4514',
  date: '2026-10-04',
  title: 'Overhead: Man hours has a picture',
  kind: 'feature',
  highlights: [
    'The Man hours card on People → Overhead now draws its numbers. Each period is a bar, stacked by field, office, bids and time not on a job.',
    'Under the bars, a line shows the office share of hours for each period, so you can see which way it is going.',
    'One line at the top reads the newest finished period for you, for example: September 2026: 1,435 hours. Office share 25%, down from 28% the month before.',
    'Point at a bar to see its numbers. A faded bar is a period that is not over yet. The table under the picture is unchanged.',
  ],
}

export default note
