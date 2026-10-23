import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5759',
  date: '2026-10-22',
  title: 'Legal Desk: the settlement floor is a slider you open with a tap',
  kind: 'feature',
  highlights: [
    'Settlement authority is one line: The firm may settle at [any amount], with what that is in dollars today. Tap the chip and a panel opens under it with a slider, a % box and a $ box that move together, in whole numbers while you slide.',
    'Whichever box you typed in last is what saves: a share of the balance, which moves as payments land, or a fixed dollar amount. The line beside Save says which, and Cancel or Escape folds the panel with nothing written.',
    'Slide to the far left and save for no floor; the firm then never has to ask.',
  ],
}

export default note
