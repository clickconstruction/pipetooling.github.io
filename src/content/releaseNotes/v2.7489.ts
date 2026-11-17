import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7489',
  date: '2026-11-16',
  title: 'Lien desk: the run window says which paper it holds',
  kind: 'feature',
  highlights: [
    'Under its title the run window now says what it holds: the monthly notices (§ 53.056) that are approved and not yet mailed.',
    'It says what is not there: a job whose notice already went, and the lien affidavits. The ? says where the affidavits print.',
    'When a job’s name does not say its street, the row shows the property’s street after the name. Two jobs at one address read as two at that address.',
  ],
}

export default note
