import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8405',
  date: '2026-11-23',
  title: 'Working hours: Job Mode tells a salaried person their hours',
  kind: 'fix',
  highlights: [
    'In Job Mode, the My Time card now shows a salaried person the working hours the office set. The Dashboard already did.',
    'The hours read with no button, and the card says the office sets them. A salaried person with no hours set still sees no question.',
  ],
}

export default note
