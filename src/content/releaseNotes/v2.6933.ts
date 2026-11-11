import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6933',
  date: '2026-11-11',
  title: 'Bids and permits: every permit on an address, past 1,000',
  kind: 'fix',
  highlights: [
    'Permit news on the Bid Board reads every permit on your bids’ house numbers. The read stopped at 1,000 rows, and San Antonio’s holds over 700 now.',
    'Past 1,000 the older permits would have dropped first, and a site’s plumbing permit could be one of them. No read had reached it yet.',
    'This site, What we can see about a GC and Find their names read the same way.',
    'The answers on names and the customer list behind Looks like a customer are read whole too.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
