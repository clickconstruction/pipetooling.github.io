import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5585',
  date: '2026-10-16',
  title: 'Prospects: the strips wait for their first read instead of saying it failed',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The GC work in flight strip on Jobs to GC and The bench needs strip on Subs no longer flash “could not be read” for a moment on every open. They draw nothing until their first answer and say so only when the read really failed.',
  ],
}

export default note
