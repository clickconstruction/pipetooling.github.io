import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2516',
  date: '2026-08-30',
  title: 'Robot bid audits: the schema',
  kind: 'feature',
  highlights: [
    'Groundwork for the new Audits lane: when a robot estimator finishes a draft bid, it can now open an audit with its open questions attached, ready for a human reviewer.',
    'Reviewer notes are kept per section (counts, footage, pricing, scope) and every note gets a written receipt once the robot has learned from it.',
    'Robots can ask and acknowledge, but only a person can mark an audit finished.',
  ],
}

export default note
