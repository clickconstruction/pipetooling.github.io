import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6058',
  date: '2026-10-29',
  title: 'Where files go: a bid’s folder by the bid pattern, and folders made as needed',
  kind: 'feature',
  highlights: [
    'A bid’s Drive folder is now named by the pattern on Documents → Where files go, the project name as it ships. A bid that already has a folder keeps it.',
    'With Make each folder when something first lands in it picked, Make the job’s Drive folders makes the job’s folder alone and writes its link on the job. Customer Pictures is made under it the first time a photo lands, and the photo files there.',
    'A press on a job that already has its folder still fills in what is missing inside it.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
