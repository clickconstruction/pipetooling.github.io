import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4678',
  date: '2026-10-05',
  title: 'Legal: each job shows the property it stands on',
  kind: 'fix',
  highlights: [
    'The Property record on the Legal desk, the firm\'s portal and both printed packets lists each job\'s own property, with a Job column. A GC\'s office addresses no longer show as the property.',
    'A job\'s owner override names the owner of record, as it does on the lien paper.',
    'Each job\'s lien dates run from its own property kind, so a house and a store in one account each get the right notice date.',
    'The matter card\'s county and owner read the first job\'s property, and a job with no linked property record shows as a gap you can fix from Lien instruments.',
  ],
}

export default note
