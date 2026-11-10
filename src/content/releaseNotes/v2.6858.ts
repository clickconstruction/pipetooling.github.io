import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6858',
  date: '2026-11-10',
  title: 'The ground under permits on a bid',
  kind: 'feature',
  highlights: [
    'A bid’s address is one typed line, and the city writes the same place its own way. Loop 1604 is 1604 to the city, Parkway is sometimes Pkwy, and a suite is left off.',
    'The app can now read a bid’s address the way the city writes one, and say when it cannot: a town whose permits are not read, a crossing, a line with no street number or no city.',
    'Run on today’s open bids in San Antonio, 7 of 25 sites have a permit on the address, and 2 of those carry a general plumbing permit.',
    'Nothing changes on screen yet. The next release puts what the city holds on a bid’s address into the bid’s window.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
