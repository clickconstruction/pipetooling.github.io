import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6408',
  date: '2026-11-03',
  title: 'The file index leaves the largest plan sets to Drive’s search, so a read never runs out of memory',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A PDF over 12 MB is held as too big for our index and left to Drive’s own search, which still finds it by its words. A 25 MB plan set had run the reader out of memory.',
    'Index this job’s files reads at most 16 MB of PDFs in one round and carries on with the rest in the next, so one heavy job never stops the press.',
  ],
}

export default note
