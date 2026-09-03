import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2729',
  date: '2026-09-03',
  kind: 'feature',
  title: 'The bid-room email looks like it came from you',
  highlights: [
    'GCs now get a proper letter: your brand at the top, the project and address, the options in a clean table with your recommendation marked, and a button that stays a button in dark-mode mail apps.',
    'The subject line carries the trade, project, proposed amount and company — easy to find again in a crowded inbox.',
    'It is signed by whoever pressed send (name, phone, email) and replies go straight to them.',
    'Revised sends say "Revised proposal (rev N)" and show your revision note as "What changed".',
  ],
}

export default note
