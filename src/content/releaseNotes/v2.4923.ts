import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4923',
  date: '2026-10-08',
  title: 'GC mode: our number gets its own door',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Our general conditions, contingency and fee on a GC project now sit where only dev, the leaders and the controller can read them. Assistants and estimators cannot.',
    'The app is ready to record which quote we carry on each trade, to share a trade’s bid tab, and to mark a bid sent, won or lost.',
    'Nothing on screen changes yet.',
  ],
}

export default note
