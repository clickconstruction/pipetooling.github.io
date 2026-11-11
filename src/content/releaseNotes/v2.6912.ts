import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6912',
  date: '2026-11-10',
  title: 'Permits: the owner of record in Austin, San Marcos, New Braunfels and Seguin',
  kind: 'feature',
  highlights: [
    'A permit outside San Antonio now reads its own county for the owner of record, the mailing address, the values and the lot. Travis, Hays, Comal and Guadalupe counties are read.',
    'A new building often has no parcel under its street address yet. The app then reads the parcel at the permit’s point, and the card says so and names the address the county uses.',
    'Open at the appraisal district opens that property at the right district. A fact a county does not publish, like the built area, is left off the card.',
    'Who pulled it now searches Google near the permit’s own city. The county answers are live once the lookup function is deployed.',
  ],
}

export default note
