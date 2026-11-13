import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7046',
  date: '2026-11-12',
  title: 'Pipeline: pressing a billed row’s lien line opens the Lien window on the right paper',
  kind: 'fix',
  highlights: [
    'Pressing File the affidavit on a billed row now opens the job’s Lien window on the lien’s own tab. It used to open on Demand letter whatever the row said.',
    'A row about a notice opens the notice’s tab. That covers a notice still owed, a late notice and a closed notice window.',
    'The bold line under the rule opens the same tab as the row above it.',
  ],
}

export default note
