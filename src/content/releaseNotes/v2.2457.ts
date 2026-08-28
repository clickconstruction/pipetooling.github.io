import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2457',
  date: '2026-08-28',
  title: 'Estimates can offer options — build them now',
  kind: 'feature',
  highlights: [
    'A draft estimate can now hold up to four priced options — Repair vs. Replace, Good / Better / Best. Press ＋ Option above the Line items: your current estimate becomes Option 1 (starred as recommended) and Option 2 starts as a copy to edit.',
    'Each option gets a name and a one-line pitch the customer will read; the ★ marks the one you recommend, and its total is what the Pipeline shows until the customer decides.',
    'Customer experience → Page already previews the real thing: choice cards with prices, the recommended one pre-selected, the document following the selection.',
    'Sending a multi-option estimate to a customer arrives in the next update — for now options are your side of the counter, and single-price estimates send exactly as before.',
  ],
}

export default note
