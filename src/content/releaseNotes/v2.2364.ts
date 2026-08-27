import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2364',
  date: '2026-08-26',
  title: 'The margin slider works on bids with no-cost rows',
  kind: 'fix',
  highlights: [
    'On the Pricing Workbench, the margin slider now prices your costed rows at the margin you pick — rows you priced by hand that have no Takeoffs cost keep their prices and stack on top of the bid.',
    'Before, that hand-set revenue was subtracted from the solve target, which could crush fixtures below their own cost and leave the slider doing nothing across most of its range.',
    'A green chip under the solver now shows exactly where the bid lands after a solve — total and blended margin.',
    'Typing a target total is unchanged: the bid still lands at the number you type, hand-priced rows included.',
  ],
}

export default note
