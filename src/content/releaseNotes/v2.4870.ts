import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4870',
  date: '2026-10-07',
  title: "Contracts: the job's activity names both signers",
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    "When two people sign a job's agreement online, the job's activity now reads Contract signed by Sam Owner and Alex Owner. Before, it named only the first signer.",
    'An agreement one person signed reads as it did. A paper on file still reads Signed contract on file (paper).',
  ],
}

export default note
