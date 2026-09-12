import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3364',
  date: '2026-09-12',
  title: 'Bank transfer card wording',
  kind: 'fix',
  highlights: [
    'On the statement\'s bank transfer card the wire address now reads "for bank ACH and wires, not for mail", the check box says "Checks can only be received at this address. Checks mailed anywhere else need to be re-issued.", and the closing line is simply "You can always call (512) 360-0599 before sending anything for clarity."',
    'The collapsed line now asks "Prefer to pay with a different method?" and reads "ACH • WIRE • MAILED CHECK" on the right.',
    'The Accounts Receivable panel uses the same words.',
  ],
}

export default note
