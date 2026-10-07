import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4724',
  date: '2026-10-06',
  title: 'Edit Job: fill in the property record without leaving the job',
  kind: 'feature',
  highlights: [
    'The Property record row lists what the lien papers read: the county, the legal description, the owner and the mailing address. Each blank shows Missing in red.',
    'Fill in the record opens the property record above Edit Job. When the appraisal roll has no parcel, the box for pasting the county’s page is already open.',
    'Pasting a county page now reads the owner, the mailing address and the exemptions correctly on the esearch county sites, Guadalupe among them.',
    'On the Lien desk, an affidavit’s missing owner or legal description opens the same window over the desk.',
  ],
}

export default note
