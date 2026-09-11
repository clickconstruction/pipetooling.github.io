import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3329',
  date: '2026-09-11',
  title: 'The bank transfer card keeps checks and wires apart',
  kind: 'fix',
  highlights: [
    'The opened "Prefer to pay by bank transfer?" card is now two halves: the transfer details on the left under "By bank transfer — ACH (direct deposit) or wire", and a boxed "By check — mail it here" on the right with the one address checks go to, on envelope lines, payable-to above it.',
    'The transfer side\'s Address row now says "for the wire form — not for mail", and the check box says outright that the bank address is not a mailbox and checks sent elsewhere may need to be re-issued.',
    'On a phone the two halves stack, check box last. The Accounts Receivable panel\'s address row carries the same "wire form only, not for mail" tag.',
  ],
}

export default note
