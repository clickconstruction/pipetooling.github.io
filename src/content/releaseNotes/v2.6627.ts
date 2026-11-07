import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6627',
  date: '2026-11-07',
  title: 'The robot fixtures guide shows every step as a short recording',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Help → add the robot’s fixtures to your count now plays six short clips: opening the list, reading a row’s backing text, ticking and pressing Add, changing a robot row’s count, setting a row aside and putting it back, and Undo on the toast.',
    'Each clip was recorded on a test bid seeded for the day and deleted after, so no real bid’s plans or prices appear.',
  ],
}

export default note
