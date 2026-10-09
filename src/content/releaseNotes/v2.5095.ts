import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5095',
  date: '2026-10-09',
  title: 'Submittals: a reviewer’s file puts a revision answered by email on the GC’s page',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A revision nobody shared goes on the GC’s page as the record once their answers are typed in and it has a package. Now a reviewer’s file dropped in Their call counts as well as a package.',
    'An older revision that never got a package can join the record. Drop the GC’s email or the redlined PDF on it.',
    'On the GC’s page, a revision on the record by its file alone says it went out by email instead of promising a PDF.',
    'Removing the last file from such a revision warns that it leaves the GC’s page.',
  ],
}

export default note
