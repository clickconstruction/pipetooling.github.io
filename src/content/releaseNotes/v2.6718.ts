import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6718',
  date: '2026-11-08',
  title: 'The cost chart’s end labels stand apart, and a chip’s cost matches the chart to the cent',
  kind: 'fix',
  roles: ['dev', 'controller', 'master_technician', 'assistant'],
  highlights: [
    'On the Charges & Value chart, on a job and on a development, the cost, true cost, cash position and value labels at the right end now sit as one column. No two overlap, and none sits on the icons of the last days. On a phone the column stands above the busy end instead of across it.',
    'On the development’s Timeline, a job chip’s cost and the chart’s end for that job now agree to the cent. The chart used to round each day’s folded line before adding them up, so the two could differ by a cent.',
  ],
}

export default note
