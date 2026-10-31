import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6194',
  date: '2026-10-30',
  title: 'A copied bid keeps each row’s plan tag',
  kind: 'fix',
  highlights: [
    'A new version of a bid, a bid copied into another trade and a duplicate now carry each count row’s plan tag, the robot’s WC-1 chip beside the name. Since the robot fixtures ground landed on 2026-10-30, a copy dropped it.',
    'The robot’s fixture pulls stay with the bid the robot read, on purpose: a copy is your count, and a pull is the robot’s record of one read of one bid.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
