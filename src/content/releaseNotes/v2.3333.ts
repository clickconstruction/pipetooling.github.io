import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3333',
  date: '2026-09-11',
  title: 'Cash App reconcile reads your split notes',
  kind: 'feature',
  highlights: [
    'When a recorded payment\'s memo names the amount that was actually sent ("Cashapp 500", "CashApp in 300 and 100", "-500 for motorcycle 1809.20 paid via cashapp"), the reconcile now matches that send to the payment, so pay that was split with Less | Additional and noted in the memo no longer sits in To review.',
    'One memo can back more than one send when it lists more than one amount.',
  ],
}

export default note
