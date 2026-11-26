import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8616',
  date: '2026-11-26',
  title: 'Short Dashboard: the office’s count and the door’s count wait until every read is in',
  kind: 'fix',
  highlights: [
    'On the short Dashboard, the line that says how many other things the office is handling, and the door’s count of yours, now draw once, together, when every read is in. Before, each landed from the two lien reads and then moved as the slower reads arrived.',
    'The list of what waits on you draws as before, as soon as the Lien desk is read. A paper never waits on a slow read.',
    'On a slow phone the two numbers may take a few seconds. They wait at most eight, then draw as they stand.',
  ],
}

export default note
