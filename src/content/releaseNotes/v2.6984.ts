import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6984',
  date: '2026-11-11',
  title: 'Permits: Austin’s permits in Williamson County name their owner',
  kind: 'fix',
  highlights: [
    'Part of Austin is over the Williamson County line. About 1 Austin permit in 30 is there, and its Property line named no owner, because only Travis County was asked.',
    'Those permits carry Williamson County’s own number for their lot. The app now asks Williamson County by that number, then by the address and the permit’s point.',
    'Measured on all 113 such addresses: none named an owner before, and 112 do now.',
    'The card says the lot is in Williamson County, and its link opens the Williamson appraisal district.',
  ],
}

export default note
