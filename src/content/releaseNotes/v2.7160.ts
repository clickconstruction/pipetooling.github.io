import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7160',
  date: '2026-11-13',
  title: 'Materials on site: a job reads every press, past the first 1,000',
  kind: 'fix',
  highlights: [
    'A job’s record of what came in, what was used and what was counted was read 1,000 rows at most. The database stops every answer there and says nothing. No job is that long yet, and the first to pass it would have lost its oldest rows on the phone, on the desk and on a site’s screen.',
    'A box filled early and not counted since would have read as empty, and its count as never done. The printed material location report read every row all along, so the paper and the screens would have disagreed.',
    'Every read on these screens now goes a page at a time until it has it all: the record, the boxes, the places, the photos, where a box was moved and the names joined on a site.',
    'Nothing looks different today. The numbers stay right as a site grows.',
  ],
}

export default note
