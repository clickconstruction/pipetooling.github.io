import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3353',
  date: '2026-09-11',
  title: 'A GC can pay by default — new jobs naming them as GC start on "Bills go to: GC"',
  kind: 'feature',
  highlights: [
    'Edit customer has a "Pays as GC by default" box. Tick it on a builder like Done Right Foundation and every new job that names them as GC starts with Bills go to set to GC — pretests bill the builder without anyone remembering to switch.',
    'It only sets the starting value: pick a GC and the job flips once; change it on the job afterward and it stays changed. Existing jobs are never touched.',
    'Done Right Foundation\'s pretest jobs on record are marked GC-pays by the office\'s one-time script.',
  ],
}

export default note
