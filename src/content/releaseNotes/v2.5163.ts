import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5163',
  date: '2026-10-10',
  title: 'GC mode: a trade partner’s pay application from its portal, behind the scenes',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A trade partner’s portal can now send a pay application and the final one, on the same form it reads them on.',
    'The conditional lien waiver it signs with each one shows as our own waiver paper, signed with a typed name and the e-sign consent.',
    'It stays off until the owner says a trade may sign its lien waivers in its portal. Until then it emails its pay application to us.',
  ],
}

export default note
