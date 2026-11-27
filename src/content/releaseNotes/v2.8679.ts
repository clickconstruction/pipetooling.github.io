import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8679',
  date: '2026-11-26',
  title: 'Papers before a job opens: the developer can delete a test job’s taken-off paper',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'Take off keeps a paper’s row for good, and no screen listed it again. A test job’s taken-off papers from the walks had no way out.',
    'On a test job the developer now reads Taken-off papers under the job’s papers, with each paper’s name, the day it came off and Delete….',
    'A paper stays when a person’s copy names it, when a GC proposal was made on it or taken as it, or when a later version names it. Its Delete… is grey and the reason is beside it.',
    'Nothing changes for the office. Take off still keeps every signature, and a real job’s papers are never listed or deleted.',
  ],
}

export default note
