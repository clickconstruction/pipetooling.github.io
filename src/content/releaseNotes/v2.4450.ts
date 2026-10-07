import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4450',
  date: '2026-10-02',
  title: 'Procurement log: enter the GC’s answer from the line that waits on it',
  kind: 'feature',
  highlights: [
    'On Bids → Submittals, a procurement log line still waiting on the GC has Enter their answer… under its status.',
    'It opens the row’s Their answer window over the log, with that part ringed and ready. No scrolling back up to the rows.',
    'A line the GC sent back offers Change their answer… instead. Once a part is approved, its line moves to Order now and the link goes away.',
  ],
}

export default note
