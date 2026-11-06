import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6570',
  date: '2026-11-06',
  title: 'A parcel the roll fills with the word Null is nothing under the pin',
  kind: 'fix',
  highlights: [
    'Some parcels on the roll carry the word Null for the owner, the legal description and the address. The lookup read them as text, so a record could have taken Null as its owner of record. Every roll field now reads Null as blank.',
    'A parcel with no owner and no legal description is treated as nothing under the pin. The lookup then tries the next parcel on a boundary, keeps the county, and offers the CAD paste box, instead of saying it found the record.',
    'Found by running the audited addresses again after the situs fix: two pins landed on such placeholder parcels.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
