import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5246',
  date: '2026-10-12',
  title: 'GC mode: a signed change order reads on the owner’s G702 again',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'A signed change order’s line on Bill the customer kept its own price and took none of our costs and fee, as it should.',
    'The G702’s line 2, net change by change orders, now adds up the signed change orders instead of reading $0.',
    'The form’s list of change orders names each one again, with its number and price.',
  ],
}

export default note
