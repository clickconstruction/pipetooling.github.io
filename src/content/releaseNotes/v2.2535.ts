import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2535',
  date: '2026-08-31',
  title: 'Robot audit questions carry more context',
  kind: 'feature',
  highlights: [
    'Each robot question on the Audits tab now shows a small tag for what it\'s about (Counts, Pricing, Scope…), and questions are grouped by topic.',
    'Robots can now anchor a question to the plans — you\'ll see a line like "On P2.1 — 4 wet tables with rough-ins drawn but absent from the fixture schedule" under the question, so you know where to look and what rides on the answer.',
    'Older questions without anchors look exactly as before.',
  ],
}

export default note
