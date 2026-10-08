import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4935',
  date: '2026-10-08',
  title: 'GC mode: a trade partner answers from its portal',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A trade partner can now send its quote from its portal, with a tick for each line, how long it holds, alternates, its own schedule of values and what it leaves out.',
    'It can also give the day its quote will come, pass, answer a line we could not read, and ask about the plans.',
    'It picks who at the company gets our emails. Each answer lands where the office already looks, such as Follow up and Compare quotes.',
    'Only a dev makes portal links while the portal is built. The office’s preview never sends anything.',
  ],
}

export default note
