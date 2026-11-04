import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6473',
  date: '2026-11-03',
  title: 'Edit and add a teammate’s licenses from their logbook',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Each license on a logbook has an Edit button, and Add a license puts in a new one.',
    'Pick the trade and the level instead of typing the name, so the logbook always reads the license right.',
    'For an electrical or HVAC license, Check TDLR shows the state’s own record and offers its expiry date with Use this date.',
  ],
}

export default note
