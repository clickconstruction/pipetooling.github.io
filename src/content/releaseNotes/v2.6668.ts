import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6668',
  date: '2026-11-08',
  title: 'The Your week sheet’s check now guards the Saturday-evening edge',
  kind: 'fix',
  highlights: [
    'A behind-the-scenes check on the Your week sheet failed on Saturday evenings, when the date the rest of the world uses is already Sunday while the company’s own day is still Saturday. That was fixed the same night. This adds a case that pins the clock to 6:30 PM on a Saturday, so the check holds that edge whatever time it runs. Nothing on a screen changes.',
  ],
}

export default note
