import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2258',
  date: '2026-08-24',
  title: 'Task cost estimates open to the controller',
  kind: 'feature',
  highlights: [
    'The controller now sees everything the cost lens shows devs: gold chips on tasks, per-person totals on Review, and stage/roadmap totals on the Plan view.',
    'The controller can add and edit estimates too — rates fill in from the pay config they already manage.',
    'Everyone else still sees no trace of costs.',
  ],
}

export default note
