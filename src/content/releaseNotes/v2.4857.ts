import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4857',
  date: '2026-10-08',
  title: 'GC mode: each trade partner company can have its own portal link',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Each trade partner company can have one portal link with no password, the way a sub has today. A dev can make it, make a new one, or turn it off.',
    'Every email we send a company will be kept as it went, so its portal can show it later.',
    'Nothing on a screen uses them yet. The portal page comes next in the GC mode real build.',
  ],
}

export default note
