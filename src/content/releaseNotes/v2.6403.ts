import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6403',
  date: '2026-11-02',
  title: 'Find a file: a file deep inside a plan set now lands on its bid or job',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A file more than eight folders down read Not under a job in Find a file, with its folders cut off, even when its bid or job held the folder at the top. The search now climbs twice as far, so those files land on their bid or job, and indexing a job or bid now reads its folders that far down too.',
    'A dev can walk the index’s rows on no job or bid up to their home again, reading nothing out of the files. It also picks up a folder linked to a job after its files were indexed.',
    'The terminal pass that indexes files with no row no longer stops when its sign-in runs out after about an hour, or when one call loses its signal.',
  ],
}

export default note
