import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3449',
  date: '2026-09-15',
  title: 'Owner of record: the job form finds it the moment a GC job exists',
  kind: 'feature',
  highlights: [
    'Edit Job → Property record: on a GC job (or a builder in the customer row) with an address and no confirmed owner, the row looks the site up on the appraisal roll by itself and shows the owner, mailing address, legal description and county — “Use” saves it on the property and links every job at that address. Direct jobs are left alone.',
    'A likely homestead (an individual who gets mail at the property) says so on the spot, in red, with the CAD link beside it — a lien on a homestead needs a contract signed by both spouses and recorded before work starts.',
    'The “Does this job need a contract?” prompt now asks the one question the roll cannot answer — “Is <customer> building this for someone?” — and “Yes — they are the builder” sets them as the GC so the notice clock runs and the owner is looked up right there.',
  ],
}

export default note
