import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6339',
  date: '2026-11-01',
  title: 'Three guides read each section once',
  kind: 'fix',
  highlights: [
    'The guide on moving between a job’s tabs told how to add a file to a job’s folder twice, word for word. It tells it once now.',
    'The guide on the one map said how to cluster the piles and how to open a record from a pin twice, the second time in older words. It says each once now, in the newer words.',
    'The guide on AIA pay applications printed the heading for an earlier application that changes twice in a row. It has one now.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
