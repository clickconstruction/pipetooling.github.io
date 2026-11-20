import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8028',
  date: '2026-11-20',
  title: 'Dev seat: a new robot’s replies name the calls that archive it and make a held seat again',
  kind: 'fix',
  highlights: [
    'When an assistant makes a new robot, its reply no longer says Archive is only a press in Settings.',
    'It names the call that takes a robot out of the fleet and brings it back.',
    'When a robot’s seat in CountTooling or TakeoffTooling was held, the reply names the call that makes it again, with the robot’s address filled in.',
    'The link button and Archive in Settings → System → Digital twins still work as before.',
  ],
}

export default note
