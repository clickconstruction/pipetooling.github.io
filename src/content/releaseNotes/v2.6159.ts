import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6159',
  date: '2026-10-30',
  title: 'The Project Board’s bidding price as a bar, a trial',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Press Show the price bars at the top of the Project Board and each bidding row draws its price as a bar on its own line: the quoted trades solid, our budget hatched, each trade with no number a dashed guess, general conditions and the fee grey. The words under the bar name each part and its trades, and any part opens the price card on those trades.',
    'The bars stay off until you turn them on, and the switch is remembered on your device. They also stay off while every bidding row is one quoted part, since a bar that says nothing the number does not is not drawn.',
    'With the bars on, the Bidding heading says the price so far and about what it comes to with every trade in.',
  ],
}

export default note
