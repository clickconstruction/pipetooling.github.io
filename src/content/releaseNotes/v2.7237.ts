import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7237',
  date: '2026-11-13',
  title: 'Subs Ledger: tick each payment against the bank',
  kind: 'feature',
  highlights: [
    'Each payment on the Subs Ledger by date has a box. Tick it once you find the payment on the bank statement. The tick keeps your name and the day.',
    'A "Checked against the bank" tile counts as you go: how many are ticked, how many are left and what they add up to. "Not checked" shows only the lines still to find.',
    'Lines that were one check are ticked together. Changing a ticked payment\'s amount or date clears its tick, and the Edit window says so first.',
    'How paid narrows the list to one method, and a back-charge now takes the day it was raised.',
  ],
}

export default note
