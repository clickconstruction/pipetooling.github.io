import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6974',
  date: '2026-11-11',
  title: 'Permits: an Austin permit’s owner read from the lot the permit names',
  kind: 'fix',
  highlights: [
    'Almost every Austin permit carries Travis County’s own number for its lot. The Property line now asks the county for that lot first, so the owner shown is the owner of the lot the permit is on.',
    'Before, the lookup matched the street address, and about 1 Austin commercial card in 25 showed a different lot. About 1 in 70 named a different owner.',
    'A lot the county does not hold yet is still found by its street address, then by the permit’s point, as before.',
    'An owner kept from the old lookup is read again the next time its card is opened, so a wrong one does not wait out its month.',
  ],
}

export default note
