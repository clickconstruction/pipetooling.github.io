import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6537',
  date: '2026-11-05',
  title: 'The property lookup reads a blank situs spelled Null, and Bexar’s situs lines without a comma',
  kind: 'fix',
  highlights: [
    'Some parcels on the roll spell a blank property address as the word Null. The lookup read it as a street and held the parcel. It now reads it as blank, so the parcel comes through on the pin alone, and a mailing line spelled Null stays blank too.',
    'Bexar’s situs lines carry the city with no comma, so a typed address could fail against its own parcel. The check now looks for the street’s first word on either side.',
    'Both came out of the read-only audit of the records the old rule filled. The hold line was right on the wrong parcels and wrong on these two kinds.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
