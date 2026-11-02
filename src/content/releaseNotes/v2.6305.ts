import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6305',
  date: '2026-11-02',
  title: 'Find a file: search every job’s Drive files by their words',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Documents → Search has a Find a file box. Type a few words from a file or its name and the files that say them list under the job or bid whose folder holds each, with the folder, the day and the size.',
    'Drive reads the words inside PDFs and the scans it has read, so a scanned permit is found by the words on its page. Press the file to open it in Drive, or Open the job.',
    'A file under no job shows under Not under a job with its folders, so you can move it. Nothing found says so and suggests other words.',
  ],
}

export default note
