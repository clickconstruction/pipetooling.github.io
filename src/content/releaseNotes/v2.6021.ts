import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6021',
  date: '2026-10-28',
  title: 'The lien details read the pay application’s retainage, and the § 53.057 row links to the release',
  kind: 'feature',
  highlights: [
    'On a job with a saved pay application, Edit Job’s “Our contract on this job” now shows the application’s retainage read only, named by application number, instead of a box to type. Change it in the AIA window. The figure is also kept in the job’s typed column, so the Lien desk reads the same number the GC signed.',
    'On a job with no pay application the box stays yours to type, as before.',
    'The Lien desk’s § 53.057 row says which source its figure reads. Once the retainage is released, the row says so, names the bill, and Open the job › takes you to it.',
    'This closes punch list #165: the retainage a GC holds on our trade jobs is one number for the AIA window, Accounts Receivable and the Lien desk, shown as owed, and released through the final application or a release bill.',
  ],
}

export default note
