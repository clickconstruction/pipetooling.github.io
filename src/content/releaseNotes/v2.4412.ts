import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4412',
  date: '2026-10-02',
  title: 'Held for suppliers: see which job is on a lien clock',
  kind: 'feature',
  highlights: [
    'Open a job on Materials → Held for suppliers. If the job is on the Lien desk, one line says when our notice or our lien is due and what is still unpaid.',
    'Open the desk on that line takes you to the job on the Lien desk.',
    'So whoever pays the houses sees which unpaid customer has a deadline.',
  ],
}

export default note
