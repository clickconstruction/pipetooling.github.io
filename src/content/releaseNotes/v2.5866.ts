import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5866',
  date: '2026-10-25',
  title: 'What customers see: the sample portals show every section a real portal can',
  kind: 'fix',
  highlights: [
    'The sample customer portals on Settings → What customers see now show the sections they left out: a recorded notice on the homeowner’s property, the pay-by date the customer gave, and the owner’s records request, each built with the same code as a real portal.',
    'The homeowner sample gains a bath remodel run by a general contractor, with the § 53.056 notice we mailed the owner about it.',
    'The owner sample’s job card — our contract to sign, the change order and Accept the work — now comes from the portal’s own reader, and its Request a visit picker offers the property.',
    'The visit picker’s properties, the test report titles and each agreement’s signer line come from the real page’s code too, so none of them can drift.',
  ],
}

export default note
