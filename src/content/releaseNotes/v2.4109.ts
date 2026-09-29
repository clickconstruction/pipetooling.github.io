import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4109',
  date: '2026-09-29',
  title: 'Submittals stage 1: the robot lives in the schedule card, and the picks card shows only when a bid has quotes compared',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'The plans’ schedule card now offers “ask the robot to read it off the plans” right under Type or paste the schedule. While the robot works, the card says so, with Cancel beside it; when it is back, the tags to confirm land under the cards at full width. The dashed box that floated under all three cards is gone.',
    'The Pricing picks card only appears on a bid that has quote lines picked on the compare, named Quotes compared. On a bid priced from a takeoff, stage 1 is two cards: the takeoff and the plans’ schedule.',
    'The header line and stage summary read “no schedule yet” instead of “0 tags · 0 picked lines”. The Build Rev 1 card says “from the schedule” when there are tags but no picks, and offers only Choose from the takeoff when there is neither.',
  ],
}

export default note
