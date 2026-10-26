import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5928',
  date: '2026-10-26',
  title: 'A page to send a GC who asks for a notarized waiver',
  kind: 'feature',
  roles: ['assistant', 'master_technician', 'dev', 'controller', 'estimator'],
  highlights: [
    'A new help guide answers the GC or vendor who asks for a notarized lien waiver. Texas dropped the notary requirement on January 1, 2022, and the guide carries the law.',
    'The guide has a public share link, so you can paste it into the email beside the signed release. The vendor reads the why without a sign in.',
    'It also names the one case that still uses a notary: a release recorded with the county clerk.',
  ],
}

export default note
