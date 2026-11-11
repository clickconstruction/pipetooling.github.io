import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6926',
  date: '2026-11-11',
  title: 'Permits: the owner of record on a Loop and along an interstate',
  kind: 'fix',
  highlights: [
    'A permit on a street ending in Loop now finds its owner in Travis County, which keeps Loop apart from the street’s name.',
    'A permit along an interstate finds its owner however the address writes it: IH 10, I H 10, I-35 or Interstate Highway 35.',
    'A permit the county had no answer for under the old spelling is asked again the next time its card opens.',
  ],
}

export default note
