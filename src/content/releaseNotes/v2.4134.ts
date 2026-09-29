import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4134',
  date: '2026-09-29',
  title: 'Submittals: the walkthrough mentions the robot only where its offer is on the page',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'On a bid that already has a schedule, Walk me through it no longer stops to describe a robot offer that is not on the page. The stop appears only where the offer does, and says what the robot needs, what it does and what you do after: tap the link, its tags show up here in a few minutes, tick the right ones.',
    'The strip under the bid name drops its “Where this submittal is” heading; the first stop of the walkthrough is now “Where you are”.',
  ],
}

export default note
