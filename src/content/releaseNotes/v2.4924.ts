import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4924',
  date: '2026-10-08',
  title: 'GC mode: what a trade partner can do from its portal, in the database',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The database can now take a trade partner’s quote, the day its quote will come, its answers to unclear lines, a pass, and a question about the plans.',
    'It can also take who at the company gets which emails, and its language.',
    'Each one acts only on the company the link belongs to. The portal’s buttons come next.',
  ],
}

export default note
