import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6321',
  date: '2026-11-02',
  title: 'Expected hours: a project’s target, set in the open, with its history (punch list #242, PR 2)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent'],
  highlights: [
    'A project can carry expected hours apart from its labor budget: who set them, when, from what to what, and why. The budget on the Costs tab never moves.',
    'Every change is kept, so the board can list the recent changes and undo the last one. Back to the budget clears the target.',
    'The leader and the office set the number. A superintendent reads his own project’s number and its reason.',
    'Nothing on a screen yet. The Projects board beside Forecast, where the number is set, follows.',
  ],
}

export default note
