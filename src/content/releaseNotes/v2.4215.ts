import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4215',
  date: '2026-09-30',
  title: 'Robot counts from TakeoffTooling keep their groups and alternates',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When a robot pastes its counts from TakeoffTooling, each row’s group now lands in the Group column instead of staying glued to the fixture name.',
    'A group TakeoffTooling marked as an alternate becomes one of the bid’s alternates on the way in, so Takeoffs, Labor, Pricing and the letter price the bid with and without it.',
  ],
}

export default note
