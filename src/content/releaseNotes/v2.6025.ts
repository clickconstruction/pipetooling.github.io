import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6025',
  date: '2026-10-28',
  title: 'GC mode: a trade partner’s portal shows the job’s phases and the dates to meet above its own bars',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a job drawn from a template with phases, Your schedule on this job opens with the job’s phases as a strip, each with its dates and days, and the dates to meet under them with Today.',
    'The strip shows names and dates alone. Another company’s bars never show, as before.',
    'The strip reads in Spanish on a Spanish portal.',
  ],
}

export default note
