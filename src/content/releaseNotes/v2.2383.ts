import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2383',
  date: '2026-08-27',
  title: 'Edit Bid: every GC is a card, and new GCs are made in place',
  kind: 'feature',
  highlights: [
    'The People section now shows GCs on this bid as identical cards — name, address, and contact chips for every GC, with the role as a small chip: ★ Bid’s GC, same letter, or own packet.',
    'The bid’s GC card carries change ▸ — the search only appears while you’re actually swapping them (keep current ↩ backs out).',
    'The + Add GCs picker gained ＋ New GC: a builder who isn’t in the system yet is created right on top of Edit Bid and joins the bid the moment it saves — no more leaving the modal to add a customer.',
    'The two explainer paragraphs shrink to one line — the role chips say it themselves (hover any chip).',
  ],
}

export default note
