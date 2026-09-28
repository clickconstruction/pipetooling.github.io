import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4006',
  date: '2026-09-28',
  title: 'GC Review: a stage with nobody waiting reads “0 waiting”',
  kind: 'fix',
  highlights: [
    'On the stage track, a step with no GC waiting at it yet read “0 none waiting”. It reads “0 waiting”.',
    'The GC Review window keeps more of its height when you switch between This week, Temperature and Scheduled, so it no longer jumps to a small box on a short tab. Total outstanding stays at the bottom edge.',
  ],
}

export default note
