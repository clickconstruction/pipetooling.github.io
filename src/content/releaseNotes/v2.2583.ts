import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2583',
  date: '2026-09-01',
  title: 'AR customer rows: tidy day and money columns',
  kind: 'feature',
  highlights: [
    'The right side of each Accounts Receivable customer row is now two tight columns — days waiting over the customer\'s average pay speed ("35d avg"), and open dollars over the job count — so every row lines up and the pace sentence no longer crowds the bill bars.',
    'The average is the customer\'s own 12-month median when they have history, or the company average when they don\'t; hover the columns for the full detail, including exact cents.',
    'A small color legend at the top of the list spells out what the bar colors mean: on pace, past their avg, 2× their avg, no bill date.',
  ],
}

export default note
