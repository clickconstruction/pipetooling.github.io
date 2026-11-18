import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7836',
  date: '2026-11-18',
  title: 'The Bill tab: bring a bid’s stages onto a job that already exists',
  kind: 'feature',
  highlights: [
    'A job from a bid that still has one line now shows a link beside Multiple Segment Generator, such as Bring B482’s stages.',
    'It opens the same window as New Job. The stages take the place of the one line, and Keep one line changes nothing.',
    'The link shows only when nothing hangs on that line. Otherwise a short line says why, such as a bill or the crew’s percent, and points to Add line item.',
  ],
}

export default note
