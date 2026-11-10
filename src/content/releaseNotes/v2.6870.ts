import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6870',
  date: '2026-11-10',
  title: 'Permit news on the Bid Board',
  kind: 'feature',
  highlights: [
    'A strip at the top of the Bid Board, Permit news on your bids, says when the city has something new on a bid’s address: an application just filed, a building permit just issued, or a general plumbing permit that lists another name.',
    'Each line has one press, Open the bid. A plumbing permit under another name comes first and stays until the bid is won or lost. Nothing is marked for you.',
    'Every bid not yet won or lost carries a chip on its row when the city has a permit on its address, such as Applied Sep 11 or Issued Nov 3.',
    'The board asks once for all its bids. A bid in a town we do not read, or with no street number, gets no chip.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
