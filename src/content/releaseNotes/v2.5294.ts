import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5294',
  date: '2026-10-12',
  title: 'Contracts: a paper built from clauses is signed as its clauses',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A trade partner signing a paper built from clauses reads its clauses, with the version under them, in English or Spanish.',
    'If a clause changes while their page is open, the page asks them to reload before they sign.',
    'The signed record shows the clauses exactly as they were signed, with the version they were signed under.',
  ],
}

export default note
