import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5502',
  date: '2026-10-13',
  title: 'Messages: leads, supply houses and candidates show their names',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A lead added to Prospects shows the name on their Prospects row, on Follow up and in their thread.',
    'A supply house, a rep at one and a candidate on the hiring board show their names in Messages too.',
    'Someone who may not open Prospects sees the name the lead was given when they were named.',
  ],
}

export default note
