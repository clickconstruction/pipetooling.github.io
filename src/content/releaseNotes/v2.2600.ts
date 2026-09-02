import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2600',
  date: '2026-09-01',
  title: 'Who owes what: open any bill as a PDF',
  kind: 'feature',
  highlights: [
    'Every bill card in the Who-owes-what view now carries the invoice-PDF tail next to View on board — one click opens that bill as a freshly generated PDF in a new tab, ready to print or hand over.',
    'It is the same PDF button the Stages table already has, so it works for every billing channel; only legacy bills with no invoice line keep the plain View on board button.',
  ],
}

export default note
