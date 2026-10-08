import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4987',
  date: '2026-10-08',
  title: 'GC mode: each project has a Schedule window',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A dev’s GC project card has a Schedule button. It opens the job’s schedule as the design spike drew it: the measures, the chart and its links, the list on a phone, Print or PDF, and Export.',
    'Press a bar to see its days, what it waits on, its spare days and what holds it.',
    'A job with no schedule yet offers Draw a first draft, from the day the work starts. A job we are still bidding, or lost, says why there is none.',
    'Nothing moves on the schedule yet. Moving bars comes next, then the office team.',
  ],
}

export default note
