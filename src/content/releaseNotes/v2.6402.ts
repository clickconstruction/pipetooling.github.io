import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6402',
  date: '2026-11-02',
  title: 'The Projects board goes by the job’s kind',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent'],
  highlights: [
    'A Working job reading Project is on the Projects board at any price. A job reading Service call stays off, even when it is priced at $25,000 or more.',
    'A job with Kind not set keeps the old rule until the office presses one: a stage In order, or a price of $25,000 and up. Nothing the leader reads each morning goes missing while the office works through the deck.',
    'A job is missing from the board and should be there? Press Project under Kind on its Edit tab. A job that only carries a GC project’s bills stays off, since nobody clocks on it.',
  ],
}

export default note
