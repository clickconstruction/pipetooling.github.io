import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5809',
  date: '2026-10-24',
  title: 'Prospects → Subs: drag a card to pin it, and Call first · Normal · Later on every sub',
  kind: 'feature',
  roles: ['assistant', 'controller', 'estimator', 'master_technician', 'dev'],
  highlights: [
    'Drag a card on the Board and it pins at the top of its column, in the order you drop them, with an amber edge and a pinned chip. Pinned cards hold their place over the flow. Press the chip to let a card flow by its record again.',
    'Call first · Normal · Later sits on every board card and on the deck’s card on Subs, where the warmth flame stood. Call first puts a company over who answers; Later puts it at the foot.',
    'By rank on the deck’s order reads the trade’s pins when the deck is filtered to one trade.',
    'One migration: the pins table and the priority column. Nothing changes for Customers or Jobs to GC.',
  ],
}

export default note
