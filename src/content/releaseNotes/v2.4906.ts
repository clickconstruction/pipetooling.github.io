import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4906',
  date: '2026-10-08',
  title: 'GC mode: the rules for asking companies to quote move into the app',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rules behind the window that asks companies to quote move from the prototype into the app, word for word. They pick which companies can be asked, those in range first, and say whether the trade will reach the two quotes we want.',
    'A contact with no email on record shows none. The prototype made one up.',
    'Nothing on screen changes yet.',
  ],
}

export default note
