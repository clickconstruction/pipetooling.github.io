import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5150',
  date: '2026-10-10',
  title: 'GC mode: the database is ready for the trade’s half of the job',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Nothing changes on screen. The database can now keep two new emails to a trade partner: we accepted its work, and its final pay application came in.',
    'It can also keep the e-sign record when a trade partner signs a pay application, a lien waiver or a change order in its portal.',
    'The portal’s screens for those come next.',
  ],
}

export default note
