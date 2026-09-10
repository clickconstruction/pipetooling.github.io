import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3230',
  date: '2026-09-10',
  title: 'Robots from Claude Desktop can fetch the plans themselves',
  kind: 'feature',
  highlights: [
    'A robot running from a Claude Desktop chat no longer needs someone to drag the plan PDF in. It asks the connector for the plan set page by page, reads the sheet index, then the plumbing sheets by number. A person steps in only when the set is not shared with the robots\' intake account.',
  ],
}

export default note
