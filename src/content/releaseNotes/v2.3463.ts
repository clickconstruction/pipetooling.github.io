import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3463',
  date: '2026-09-15',
  title: 'Pipeline: a job with no clock-ins reads “No hours”',
  kind: 'fix',
  highlights: ['Under the Progress & payment bar, a job nobody has clocked in on now reads “No hours · 100% Sep 11” instead of “nobody clocked in · …”. The hover still says nobody clocked in.'],
}

export default note
