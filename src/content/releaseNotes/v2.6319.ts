import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6319',
  date: '2026-11-02',
  title: 'Find a file reads our own index first: the words inside every file we have read, ranked, in milliseconds',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Documents → Search → Find a file now asks our own index before Drive. The index holds the words inside every file the app has read, ranked with the file’s name first, then its folders, then its text, and answers in milliseconds. The count line says whether the hits came from our index or from Drive.',
    'A hit from the index shows the line where your words appear, with the words in bold, for a Google Doc, a PDF with real text or a text file. Drive’s own search fills in behind: its hits the index did not name follow, so a file the index has not read yet still shows.',
    'The job window’s Documents tab has a new press under In the folders, Index this job’s files. It reads the job’s files forty at a time, says how many are left, and lists any file it could not read with the reason. A file that read slowly or failed can be tried again.',
    'Every ten minutes the app indexes the files that landed or changed in the jobs Shared Drive since its last look, and drops the row of a file that was trashed, so the index keeps itself current once a job is in it.',
  ],
}

export default note
