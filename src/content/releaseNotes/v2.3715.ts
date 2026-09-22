import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3715',
  date: '2026-09-22',
  title: 'Hiring: the Try-out card tallies what the leaders said and suggests the call',
  kind: 'feature',
  highlights: [
    'Every card on the Try-out stage now shows the helper’s days worked and each leader’s latest word by name — Mike ✓ “careful, a bit slow”, Jake (sub) ✗ — plus who was asked and has not answered yet.',
    'One line under the tally says what the numbers suggest: 3 leaders said yes — hire? · 2 said no — pass? · waiting on Mike · needs another leader. The office still presses the button.',
    'A day the helper worked with nobody who could run the job says so on the card — no lead listed; ask Dispatch to put a master on the block — because nobody was asked that day.',
    'Keep trying answers “not yet”: the card notes who pressed it and when, and the suggestion comes back only when a new verdict lands.',
  ],
}

export default note
