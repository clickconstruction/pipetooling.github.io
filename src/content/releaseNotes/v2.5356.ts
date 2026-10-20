import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5356',
  date: '2026-10-12',
  title: 'Messages: a person’s flow says it is our move while we owe them something',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When Follow up says we owe someone something, their flow’s step on now reads as our move.',
    'Once it is marked done, the step reads whose move it was before.',
  ],
}

export default note
