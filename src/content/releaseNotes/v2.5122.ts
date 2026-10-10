import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5122',
  date: '2026-10-09',
  title: 'ZZ test jobs leave search, the Dashboard’s job cards and Customers',
  kind: 'feature',
  highlights: [
    'Search no longer finds ZZ test jobs or ZZ test customers.',
    'The Dashboard’s job lists, its map and the Needs you cards for idle jobs, returned checks and test reports leave them out too.',
    'On Customers, a ZZ test customer is gone, and a real customer’s money and page leave out its test jobs. Nothing real changed.',
  ],
}

export default note
