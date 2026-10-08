import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4938',
  date: '2026-10-08',
  title: 'GC mode: an answer about the plans reaches the companies on the trade',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'When you record an answer about the plans, each company still asked on that trade is listed under it, ticked.',
    'One press records the answer and emails it to the companies ticked, each in its own language, with its portal link.',
    'An answered question says who it went to, and offers it to any company that has not had it. Nobody gets it twice.',
    'Only a dev sends while GC mode is built. Everyone else records the answer as before.',
  ],
}

export default note
