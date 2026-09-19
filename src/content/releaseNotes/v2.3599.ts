import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3599',
  date: '2026-09-18',
  title: 'PO codes: write down what they said they need, and read it back on the invoice',
  kind: 'feature',
  highlights: [
    'Materials → PO Generator and Dispatch Mode → PO now ask "What they said they need" instead of "Notes" — the tech has just told you (40 ft of ¾" PEX, a drain machine); write it in their words. Still optional.',
    'In Dispatch Mode the claim shows under the big code, and Copy and Text to the tech carry it, so the tech reads what was written down.',
    'Both ledgers title the column "Said they need".',
    'On a supply-house invoice, a PO # that matches the ledger now shows a card under the field — the job, who it was for, when and by whom it was minted, and what they said they needed — right under the amount, so a bill that does not match the claim is a question the office can ask the day it arrives.',
  ],
}

export default note
