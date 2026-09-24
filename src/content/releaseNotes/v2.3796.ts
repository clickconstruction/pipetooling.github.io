import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3796',
  date: '2026-09-24',
  title: 'Contract sweep: a contract for another address is never offered',
  kind: 'fix',
  highlights: [
    'The sweep’s Drive pass no longer offers a customer’s paper for one job to their job at a different address — a file or folder that names 105 Dover is not a find for the job at 141 Encino, whatever folder it sits in.',
    'The ⋯ → Look in Drive window lists such a file under No match with the reason: “names 105 Dover, not the job’s address”.',
  ],
}

export default note
