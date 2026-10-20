import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5296',
  date: '2026-10-12',
  title: 'GC mode: Trade partners shows each company once, and each trade with its companies',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'By company gives each trade partner one row. You see the steps it went through, the step on now, a line per job and whether it opened its portal.',
    'A job that ended reads declined or not carried, not not started.',
    'By trade gives each trade a row, A to Z, with every company on it and its step and day. The late ones come first.',
  ],
}

export default note
