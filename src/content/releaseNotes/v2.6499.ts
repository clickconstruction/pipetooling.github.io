import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6499',
  date: '2026-11-04',
  title: 'The Development page’s cost timeline draws value created and prints',
  kind: 'feature',
  roles: ['dev', 'controller'],
  highlights: [
    'Tick Value created on the Timeline to see the blue line on the right axis: each job’s percent done times its price, summed over the site, stepping on every field report and hand-set percent.',
    'A job with no dated percent adds its current percent at the end of the line, and the line under the chips says how many did.',
    'Press Print or save as PDF under the chart to open it in a print window, where it prints or saves as a PDF.',
  ],
}

export default note
