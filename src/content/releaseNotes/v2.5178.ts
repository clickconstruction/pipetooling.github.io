import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5178',
  date: '2026-10-10',
  title: 'GC mode: a trade partner signs its lien waivers in its portal',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A trade partner sends its pay application from its portal, with the conditional waiver it signs.',
    'Once we pay a draw, it signs its unconditional waiver there. The final pay application and final release work the same way.',
    'The emails we send a trade partner now ask for each of these in its portal.',
  ],
}

export default note
