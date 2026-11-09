import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6804',
  date: '2026-11-09',
  title: 'The dev seat loads submittals and says where they stand',
  kind: 'feature',
  highlights: [
    'A dev’s agent can now load submittal rows onto a bid from the MCP seat: one tag or many, added to the draft or changed by tag, the way Add a row and Edit do on Bids → Submittals. It plans first and shows how each row will read, then applies.',
    'It can also write the order log’s facts on a part: the day it was ordered, the PO, the day it is expected, the day it was delivered and a note for the GC. The plan says where the part stood and where it will stand.',
    'One read answers where everything stands: the revision, each row and its answer, the four steps with their counts, the Next line and the status in plain words, ready to read back or paste. It also sets the log’s delivered count beside what Materials on site holds, since the two are not tied yet.',
    'Nothing is shared with the GC and nobody is emailed or texted. The seat writes only what the signed-in dev could write on the tab.',
  ],
}

export default note
