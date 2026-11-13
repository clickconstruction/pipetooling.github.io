import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7119',
  date: '2026-11-13',
  title: 'ZZ test estimates no longer count in the Bridge’s won rate',
  kind: 'fix',
  highlights: [
    'On the Bridge, the estimates’ won rate now leaves out ZZ test estimates, as the bids’ rate already leaves out ZZ test bids.',
    'An estimate is a test when its customer’s name starts with ZZ, or its title does after the words Estimate for.',
    'The Monday email follows the same rule. A dev who chooses to show ZZ test jobs still sees them counted.',
  ],
}

export default note
