import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6653',
  date: '2026-11-07',
  title: 'Report by line: the Pipeline bar shows each line at the number the crew gave it',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'estimator', 'superintendent'],
  highlights: [
    'On a job with two or more priced lines, once the crew has reported a number for any line, each block of the Progress & payment bar shows that line done to its own number. Before, the bar poured the job\'s percent down the lines in order, so a half-done first line read as finished and a started third line read as untouched.',
    'A line with no number yet reads as not started; a paid or billed line keeps its green or blue. The tick, the % done box and the legend still read the job\'s one number.',
    'Found on punch list #130\'s live walk as a helper: the report filed 50% and 25% on two of four lines and the board drew the first line full and the second at 72%.',
  ],
}

export default note
