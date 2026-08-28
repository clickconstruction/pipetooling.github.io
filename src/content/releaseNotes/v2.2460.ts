import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2460',
  date: '2026-08-28',
  title: 'Customers choose their option and sign',
  kind: 'feature',
  highlights: [
    'Multi-option estimates now send. The customer\'s page shows your options as cards — name, pitch, price, and a "What\'s included" breakdown — with your ★ recommended one pre-selected.',
    'Picking a card swaps the document and total live, and the Approve button says exactly what they\'re committing to: Approve "Replace 50-gal" — $3,400.00.',
    'When they accept, the estimate locks to the option they chose — the accepted document, the job you create from it, and every total in the app show that scope. The acceptance email tells you what they picked.',
    'The estimate email lists every option\'s price with a star on your recommendation, and Preview as customer rehearses the whole flow before you send.',
  ],
}

export default note
