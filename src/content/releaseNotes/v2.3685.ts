import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3685',
  date: '2026-09-21',
  title: 'Share with a teammate: send both prices',
  kind: 'feature',
  highlights: [
    'On Bids → Pricing, when the price you are viewing is not the ★ customer’s price, Share with a teammate asks which one to send. There is now a third choice: Both.',
    'Both makes one package with the customer’s price first and the one you are viewing under it, each with its own heading and total. Copy for text, Send via my mail and Send for me all carry the pair.',
    'Print and Export still take one price at a time.',
    'Also fixed: sharing, printing or exporting the ★ price while viewing an alternate that has its own takeoff came out as $0.00 on every row. The ★ price now prices against its own counts.',
  ],
}

export default note
