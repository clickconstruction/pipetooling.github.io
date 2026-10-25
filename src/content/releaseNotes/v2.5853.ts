import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5853',
  date: '2026-10-25',
  title: 'The Collect desk, PR 2 of 7: press Collect, then Break it down',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The Bridge’s Collect card now opens: press the card, and under Today’s reading a Break it down button opens the Collect desk, a window that reads the billed-not-paid pile by where each bill stands against its payer’s own pace.',
    'Three tiles say how much of the pile actually waits on a call, who holds it, and where the pile goes left alone. A bar and a legend split the pile into not yet due, promised, past a promise, late with no date, and doubtful, with Collections kept apart.',
    'Each payer that holds the pile gets a row: open, the oldest bill, how fast they pay and why the desk thinks so, and where the account stands: the promise, the hand-marked bills, the last call, the lien paper. Everyone else is one line.',
    'What slows Collect before any call folds under one line. The moves, the owner’s decisions and the week’s plan come in the next part.',
  ],
}

export default note
