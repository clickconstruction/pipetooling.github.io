import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8394',
  date: '2026-11-23',
  title: 'People → Contracts: a sub’s company has its own papers',
  kind: 'feature',
  highlights: [
    'A trade company’s row on People → Contracts lists its own papers once, like the subcontractor agreement and the W-9, with who signed and when.',
    'Send for signature sends the company a paper from the Contract Book. It opens on the owner and their email, and goes out under our name.',
    'Enter from paper keeps a paper the company signed on paper, with who signed it and the day.',
    'A worker’s own papers stay on their row and say which company they sign for.',
  ],
}

export default note
