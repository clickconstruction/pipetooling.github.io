import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6317',
  date: '2026-11-02',
  title: 'The dev seat keeps a plan set or a paper on a plan part, as the Plans section does',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A dev’s agent can add a set of drawings to the part a job builds from — issued, addendum, permit, construction, or our as-built — and say whether the part builds from it, the way the job window’s Plans section adds one. It plans first, reads the plan, then applies it.',
    'It can keep a paper beside the set it goes with — a spec, a submittal, a schedule, a task list — with the day it came, its link, the question it asks of the estimators or Dispatch, and an owed state for a paper we are still waiting on; the site’s History line is written as the office’s would be. When an owed paper lands, one call marks it came.',
    'A plan set a robot or the dev seat files for a bid now lands on the plan part of the bid’s job too, when the job has one, so the job’s Plans section shows the set the robots read; the bid keeps its own row.',
  ],
}

export default note
