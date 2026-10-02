import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4404',
  date: '2026-10-02',
  title: 'Lien desk: see which supply houses are still owed on a job',
  kind: 'feature',
  highlights: [
    'A job on the Lien desk shows a small storefront and the money while a supply house is still owed on it. Teal means a job account is open.',
    'Open the job to see each house: what is unpaid since when, when we expect its own notice, what we paid and what it is owed.',
    'One bold line says if the money owed to us covers what the houses are owed.',
    'Copy for an email writes the paragraph for you. Open in Held for suppliers lands on that job in Materials.',
  ],
}

export default note
