import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8237',
  date: '2026-11-21',
  title: 'Dispatch: a request on a ZZ test job rings no phone',
  kind: 'fix',
  highlights: [
    'A new Dispatch request on a ZZ test job or a ZZ bid pushed every dispatcher’s phone, like a real one. A walk of the app could ring the office.',
    'Such a request now rings no phone. Its line still shows in the Dispatch inbox, so a walk can read it there.',
    'This takes effect once the function is deployed.',
  ],
}

export default note
