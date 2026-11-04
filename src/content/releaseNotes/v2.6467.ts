import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6467',
  date: '2026-11-03',
  title: 'The Scoreboard says which job to look at right now',
  kind: 'feature',
  roles: ['dev', 'controller', 'master_technician', 'assistant'],
  highlights: [
    'A line under Right now at the top of the Scoreboard names one job worth a look. A job with no price that is already costing comes first.',
    'Otherwise it names the job that carried the site, with its profit. Press the job’s number to open it.',
    'A leader or an assistant reads the line in hours and earned dollars, never a cost. On their board a job with hours on it no longer folds under Nothing on them yet.',
  ],
}

export default note
