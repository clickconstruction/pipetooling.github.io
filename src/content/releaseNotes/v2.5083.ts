import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5083',
  date: '2026-10-09',
  title: 'GC mode: the schedule’s pull and days-back offers move into the app',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The rules that offer to pull work in when a trade finished early, and the offers to get days back on a late job, now live in the app. Nothing shows them yet; the schedule’s weekly walk brings them to the screen next.',
  ],
}

export default note
