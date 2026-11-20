import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8056',
  date: '2026-11-20',
  title: 'Share stage dates with a GC is back under the GC picker on a saved job',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Share stage dates with this GC switch now shows on a saved job, under the GC picker in the GC/Builder row.',
    'Since v2.2933 it showed only on a new job’s form, where it could not work, so no job could turn it on.',
    'It is still off on every job until someone turns it on. Nothing reaches a GC until then.',
  ],
}

export default note
