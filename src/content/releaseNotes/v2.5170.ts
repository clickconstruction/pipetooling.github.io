import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5170',
  date: '2026-10-10',
  title: 'GC mode: a place to keep the files trade partners send, behind the scenes',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Each file a trade partner sends from its portal will be kept as a link to the job’s Drive folder, never a copy.',
    'A change it asks for and a quote it sends can now carry their file’s link.',
    'Nothing uploads yet. The portal’s file pickers come next.',
  ],
}

export default note
