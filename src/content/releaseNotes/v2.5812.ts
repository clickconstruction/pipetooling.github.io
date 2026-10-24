import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5812',
  date: '2026-10-24',
  title: 'Flows: a candidate has a flow, a sub coming on has a lane, and both carry their qualifications on one scale for the trades',
  kind: 'feature',
  roles: ['assistant', 'controller', 'estimator', 'master_technician', 'dev'],
  highlights: [
    'A candidate on the Team hiring board has a flow of their own beside their thread: Screening call, Qualifications, Try-out, Hired or passed, each read from the board itself. Settings → Flows gets a Candidate tab.',
    'A sub coming on gets a lane before their jobs on the sub flow: Reached out, Qualifications, W-9 in, Insurance in, Agreement signed, First job done, Kept or let go, read from their thread, their papers on People and their sheets.',
    'Qualifications is one scale for the trades, in the owner\'s words: 0 never done it, 1 some experience and no tools, 2 says they can run a job alone and no tools, 3 the same with tools. Plumbing, Electrical and HVAC each get a level, plus the license they hold or none, and their home, where they drive in from, found on the map. Open the Qualifications step and press Add their qualifications.',
  ],
}

export default note
