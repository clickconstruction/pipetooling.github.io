import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3004',
  date: '2026-09-07',
  title: 'Property lookup: the county, legal description and owner of record fill themselves',
  kind: 'feature',
  highlights: [
    'Edit customer → Additional addresses → Property legal info now looks the property up on the Texas parcel roll (the appraisal districts\' own data): county, legal description, owner of record and the owner\'s mailing address arrive with the source district and tax year printed beside them.',
    'The county comes from the parcel under the map pin, not a guess from the city — and when the sources disagree (Schertz sits in three counties) you pick from labelled pills.',
    'Nothing you typed is ever overwritten: the lookup fills blanks, and any field that differs from the record offers a one-click "use the record\'s" link.',
    'Homestead stays your call — the roll has no exemptions — but the panel says why it suggests one, and the CAD link is right there for the day-of-filing check.',
  ],
}

export default note
