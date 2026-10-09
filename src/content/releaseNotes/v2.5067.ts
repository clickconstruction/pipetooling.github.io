import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5067',
  date: '2026-10-09',
  title: 'Help: “turn a won bid into a job” starts with what to do first',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The guide now opens with three steps: mark the bid Won and press Open the job, answer the price question if New Job asks it, then fill in the crew and press Create Job.',
    'The rarer cases of handing a job to Dispatch, and the Tips, now sit under a Reference heading at the end of the guide.',
    'Nothing in the app changes, and no sentence was cut.',
  ],
}

export default note
