import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3392',
  date: '2026-09-14',
  title: 'Drive pass: reads the whole folder tree and recognises customer folders',
  kind: 'fix',
  highlights: [
    'The first live pass found the signed contracts sit two and three folders deep, in folders named by customer (“_Mason Dudley”, “_Knight Contracting”). Found in Drive now walks the full folder chain and matches a customer folder by its identifying words in any order.',
    'Inspection reports, geotech reports, insurance riders, sample subcontracts and templates no longer read as contracts just because “signed” or “subcontract” is in the name.',
  ],
}

export default note
