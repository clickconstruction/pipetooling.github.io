import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4331',
  date: '2026-10-01',
  title: 'Submittals: Split keeps a row’s parts',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'Splitting a submittal row that lists parts now gives every new row its parts. Before, the split went through but the parts did not save.',
  ],
}

export default note
