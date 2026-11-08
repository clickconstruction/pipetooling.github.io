import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6711',
  date: '2026-11-08',
  title: 'The site’s cost timeline lists the jobs it cannot draw',
  kind: 'feature',
  roles: ['dev', 'controller'],
  highlights: [
    'Under the Timeline’s chart, a grey strip lists every job with no dated charge or payment, with its cost so far and why it is off the chart: the undated sheets or charges to date, or nothing charged yet.',
    'Press the job’s name in the strip to open it. The line under the chips now says the jobs are listed under the chart instead of only counting them.',
    'The strip’s last line adds the chart’s end and the jobs off it. That sum is the Scoreboard’s cost before overhead, so the two views agree to the cent. Narrowing the chart with a chip leaves the strip on the whole site.',
    'Print or save as PDF carries the strip under the key.',
  ],
}

export default note
