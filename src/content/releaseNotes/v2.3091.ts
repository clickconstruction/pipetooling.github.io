import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3091',
  date: '2026-09-07',
  title: 'Pick who the robots calibrate to, from Settings',
  kind: 'feature',
  highlights: [
    'Settings → Digital twins has a Calibration standard card: each estimating user shows STANDARD or PRACTICE with a one-click switch, so changing who the robot scores are measured against no longer needs a database change.',
    'The card says in one line who the standard is, and warns when nobody is set, because then no robot score can count toward Gate B.',
  ],
}

export default note
