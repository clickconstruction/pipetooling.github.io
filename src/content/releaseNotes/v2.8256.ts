import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8256',
  date: '2026-11-21',
  title: 'Permits: a San Antonio application learns the day its permit was issued',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The nightly read of San Antonio’s applications now also picks up the ones whose permit was just issued, however long ago they were filed.',
    'Before, an application was read for ten days after it was filed and never again. One that got its permit later kept reading as still waiting.',
    'Market’s clock from an application to its permit keeps filling with new jobs, where it would have slowly run dry.',
  ],
}

export default note
