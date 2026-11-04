import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6493',
  date: '2026-11-04',
  title: 'The Development page’s Money look draws the site’s cost timeline',
  kind: 'feature',
  roles: ['dev', 'controller'],
  highlights: [
    'A third view on the Money look, Timeline, draws the Job Summary’s cost chart over the whole site: every job’s charges on one red line, cost to date, and the cash position in green.',
    'Rest the pointer on any step to read which job the money went out on, one line per job and kind of charge for the day.',
    'Press a job’s chip above the chart to narrow it to that job, or several. All jobs is the default, in the Money look’s own order.',
    'Devs and controllers only. The reads start when the view opens, in one batched read per source for the whole site.',
  ],
}

export default note
