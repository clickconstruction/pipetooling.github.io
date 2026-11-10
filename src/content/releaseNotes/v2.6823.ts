import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6823',
  date: '2026-11-09',
  title: 'The Bridge leaves ZZ bids out: the robots\' shadow bids are no asks',
  kind: 'fix',
  highlights: [
    'A bid whose project name starts with ZZ, the robots\' shadow and backtest bids and the office\'s test bids, no longer counts on the Bridge. About half of the window\'s bids opened were robots\'.',
    'Market counts no such bid as an ask and no GC\'s first bid from one. Sales shows none sent, won, lost or awaiting. Vectors credits nobody with one. The cash forecast lists none as a bid due.',
    'It is the bid picker\'s own Hide robots rule, and it follows the same switch as ZZ test jobs: a dev who shows them sees the bids too. The Monday sheet email follows.',
  ],
}

export default note
