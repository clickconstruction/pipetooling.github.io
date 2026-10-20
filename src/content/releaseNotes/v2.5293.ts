import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5293',
  date: '2026-10-12',
  title: 'GC mode: Trade partners shows every company by step, the late ones first',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Trade partners has By step beside its list. Every company sits on the step of its flow, with its day.',
    'Tiles at the top count the companies getting set up, quoting and building. Needs a hand today counts the late and the lapsed.',
    'Each step has its own button: Ask the 4 for papers, Remind the 1 late, Open the compare or Bill day.',
    'Pick a job or a seat to narrow the whole board.',
  ],
}

export default note
