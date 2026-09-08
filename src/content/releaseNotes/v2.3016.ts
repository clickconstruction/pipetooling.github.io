import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3016',
  date: '2026-09-07',
  title: 'Property record: paste the CAD page, and a link straight to the parcel',
  kind: 'feature',
  highlights: [
    'No parcel under the pin? Open the district\'s page for the property, select all, copy, and use "Paste the CAD page…" — the legal description, owner, mailing address and homestead exemption are picked out for you to keep or fix.',
    'Once a property has its Prop ID, the CAD link opens that exact parcel page on the district site instead of the search form (Comal, Hays, Guadalupe and the other esearch counties, plus Bexar).',
    'The lookup itself finds more parcels: it now checks the map at a normal scale, then widens a few metres when a pin lands on the street.',
  ],
}

export default note
