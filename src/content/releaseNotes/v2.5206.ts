import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5206',
  date: '2026-10-10',
  title: 'GC mode: a trade partner’s side of the schedule, behind the scenes',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The portal now knows the new dates a trade partner was told of, and whether it answered.',
    'It knows the late notices on its own work, our answers to them, its weekly look-ahead and its crew counts.',
    'The screens that use these come next. Nothing changes on the page yet.',
  ],
}

export default note
