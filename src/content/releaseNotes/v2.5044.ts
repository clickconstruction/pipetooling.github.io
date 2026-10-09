import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5044',
  date: '2026-10-09',
  title: 'GC mode: a trade partner’s portal reads its own work, and can answer a charge or ask for a change',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A trade partner’s portal now reads the job it won: its statement of work, the charges to it and the changes it asked for.',
    'Of a change order, it reads only its own part. It never sees the price to the customer.',
    'A trade that went to another company now reads as lost, without saying who won it.',
    'The portal can take a charge’s answer and a change request. The buttons come next.',
  ],
}

export default note
