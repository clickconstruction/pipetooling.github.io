import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6520',
  date: '2026-11-04',
  title: 'The property lookup no longer fills a street the map cannot find',
  kind: 'fix',
  highlights: [
    'A street the map could not place used to come back lien-ready with whatever parcel sat at the city’s pin. The lookup now holds that pin and says so: the map has no street by that name near the city, so the roll was not asked.',
    'A parcel whose own address on the roll names another lot is held too, and nothing is filled from it. The line names the roll’s address, so you can see what it found.',
    'The county still resolves on a held lookup, and the CAD paste box still works. The nightly owner save skips a held property and counts it in its summary.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
