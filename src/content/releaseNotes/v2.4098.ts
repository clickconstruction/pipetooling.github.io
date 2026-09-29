import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4098',
  date: '2026-09-28',
  title: 'Contracts & terms: read any contract as the customer sees it, with sample information',
  kind: 'feature',
  highlights: [
    'Every card on Settings → Contracts & terms has a Read it as the customer sees it button. It opens the customer’s own page — the agreement to sign, the estimate page, the bid room, the notice or letter — in a window, filled with sample information, and finds that card’s wording on it, lit yellow.',
    'When the wording is on more than one page, chips switch between them. The footer opens the page in a new tab, prints it, and carries the card’s edit door, so reading turns straight into fixing.',
    'The sample is the same one What customers see uses — Sam Sample at 100 Sample St — so nothing on the page is a real customer. The button beside ⋯ takes the reader full screen.',
  ],
}

export default note
