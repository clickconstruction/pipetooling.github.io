import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6475',
  date: '2026-11-03',
  title: 'The dev seat can check and update a teammate’s licenses',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'An assistant on the dev seat can add a teammate’s license or change its level, number, expiry or note, plan first and then apply.',
    'It checks an electrical or HVAC number against the state’s TDLR record before it writes the date.',
    'A license it saves reads in the logbook exactly like one saved from the logbook, and Dispatch hears of one expiring within 30 days.',
  ],
}

export default note
