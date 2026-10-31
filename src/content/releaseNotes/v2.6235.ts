import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6235',
  date: '2026-10-31',
  title: 'Making a new bid version works again',
  kind: 'fix',
  highlights: [
    'Early on 2026-10-31, making a new version of a bid stopped working with a permission error. That covered adding a GC’s packet and trying a variant. It works again.',
    'Adopting a bid into a package works again too.',
    'The robot’s fixtures you took still follow your rows into the new version, and move with an adopted bid.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary'],
}

export default note
