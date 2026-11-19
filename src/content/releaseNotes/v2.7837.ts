import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7837',
  date: '2026-11-18',
  title: 'Liens: the dev seat checks a stamped scan against the lien on record, and replaces a wrong saved copy',
  kind: 'feature',
  highlights: [
    'A stamped affidavit that is already on record is now checked, not turned away. The dev seat reads the paper against the record and names each thing that differs: the claim, the months, the notice day, the property, the owner, the county and the day filed.',
    'When the record and the paper differ in their words, the seat says the copy to mail would not match the filed paper. Mail a photocopy of the stamped page for that lien.',
    'A saved copy that is the wrong file can be replaced from the seat, with a reason. The old file goes to the trash of the job’s Drive folder, where Drive keeps it 30 days.',
    'Nothing on the Lien desk’s screens changed, and no lien on record was changed by this.',
  ],
}

export default note
