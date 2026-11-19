import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7935',
  date: '2026-11-19',
  title: 'Permits: a row says when a plumbing permit at its address is not counted',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On Prospects → Permits, a San Antonio job that reads none yet now says when a plumbing permit sits at its street address without counting as the job’s own.',
    'In the ledger the line reads at this address, not counted, with who the permit lists and the day. The skim card adds the work the permit names, such as a water heater or a suite number.',
    'Read it and judge. If it is this job’s plumber, press Decide… and pick Has a plumber.',
    'The other four cities never show the line, because a plumbing permit at the address always counts there.',
  ],
}

export default note
