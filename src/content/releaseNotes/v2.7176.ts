import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7176',
  date: '2026-11-13',
  title: 'Subs pay: paying a sub is the same Record payment window as pay stubs',
  kind: 'feature',
  highlights: [
    'On Jobs, Subs, Pay, a sheet\'s Payment… now opens Record payment, built from the same pieces as the pay stubs\' window. One line shows the sheet\'s total, what is paid and what remains.',
    'Amount paid starts on what remains. Type less to record a part payment: the window says what stays due, and the sheet stays in the pay run until nothing is left.',
    'How it was sent is a row of chips: Check, Zelle, Mercury, Cash App, Apple Pay, Cash, Client direct, Other. A check keeps its number. The method shows beside the payment in the sheet\'s Payments list.',
    'An amount past what remains is refused, and the window says by how much. The memo is still the only text the sub reads on their portal, and a tick keeps it for the office.',
  ],
}

export default note
