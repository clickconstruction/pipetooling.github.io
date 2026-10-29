import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6044',
  date: '2026-10-29',
  title: 'A robot can keep a line in a development’s History, and read the whole of it',
  kind: 'feature',
  highlights: [
    'Through the dev seat, a robot keeps a line in a development’s History the way a person does: what happened, when it happened, about the site or one piece, from what source, under the robot’s own name. It plans the line first and the plan shows how it will read; then it keeps it. The line shows in History at once, marked via MCP.',
    'The same seat reads a site’s history as people wrote it, every line whole: the kept lines and the notes on its jobs and bids, newest first, narrowed to one job or one bid or to lines since a moment.',
    'A kept line never changes, whoever kept it. A correction is a second line.',
    'This is the door a backfill comes through: a mailbox’s worth of what happened on a site, one line per thread, at each email’s own time.',
  ],
}

export default note
