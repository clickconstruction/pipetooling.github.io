import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6138',
  date: '2026-10-30',
  title: "The office's round drawn as ten workday columns",
  kind: 'feature',
  highlights: [
    'The Dashboard card The office’s round now draws the last ten workdays as columns. A column’s height is the stations marked that day out of the stations the round visits. Hover one to read its time and who ran it.',
    'A workday the round missed is an empty red ring, so a miss shows as a gap in the row of days and not only as a sentence. Today’s column fills in blue as the round runs.',
    'The counts are chips, still open 8 › and questions 2 ›, and each opens Quickfill at the first of those stations. The old sentence is the muted line under the strip, with Open Quickfill › beside it.',
    'A prototype from punch list #217, Show it, don’t say it. Nothing about the round or its marks has changed.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
