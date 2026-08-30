import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2518',
  date: '2026-08-30',
  title: 'Finish audit closes the loop everywhere',
  kind: 'feature',
  highlights: [
    'Finishing a robot bid audit now also marks the robot’s CountTooling takeoff as reviewed — one button ends the whole review, nothing left to tidy in the other app.',
    'Reopening an audit puts the takeoff back in the review lane the same way.',
  ],
}

export default note
