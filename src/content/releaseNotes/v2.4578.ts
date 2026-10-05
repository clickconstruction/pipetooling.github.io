import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4578',
  date: '2026-10-05',
  title: 'Sub lien waivers: a payment counts as settled after seven days',
  kind: 'fix',
  highlights: [
    'When you send a sub a lien waiver, the app now treats a payment as settled once it is seven days old. It was five.',
    'That matches the seven days a customer\'s check waits before an unconditional release is offered.',
    'It is still a guess. The tick box in the window lets you correct it.',
  ],
}

export default note
