import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6002',
  date: '2026-10-27',
  title: 'Waivers kept on a bid read right everywhere',
  kind: 'fix',
  highlights: [
    'A lien waiver made from a bid lives on the bid, not on a job. The releases-owed count on Needs You, the Waivers to sign window, the signature inbox lanes and Documents now read only the waivers kept on a job and leave a bid’s where it is, under Already on this bid.',
    'The app’s picture of the lien release table matches the database again, so a bid’s waiver can never be mistaken for a job’s on those screens.',
  ],
}

export default note
