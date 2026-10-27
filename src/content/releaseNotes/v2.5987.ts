import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5987',
  date: '2026-10-27',
  title: 'A waiver signed by code shows his signature on the page, and says how he signed',
  kind: 'fix',
  roles: ['assistant', 'controller', 'estimator', 'master_technician', 'dev'],
  highlights: [
    'When the leader signs a waiver with his code, or types his name, the page in the window now writes his name in script on the signature line, the way the print and the PDF already did. This holds on the job\'s Release of Lien window and on Bids → Lien Release.',
    'The Get it signed step now says how he signed: "with his code on Wendi\'s screen", "drawn on Wendi\'s screen", or "in ink before a notary". It used to say "drawn" for every signature made on someone else\'s screen.',
    'On Bids → Lien Release, the sign window checks whether his code is set once when it opens, instead of again every moment it stays open.',
  ],
}

export default note
