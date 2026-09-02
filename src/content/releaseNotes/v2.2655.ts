import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2655',
  date: '2026-09-02',
  title: 'Picked quotes land on your bid costs',
  kind: 'feature',
  highlights: [
    'The compare view gains "Apply picks to costs": your picked supply-house prices replace each row\'s materials cost — labor untouched, tax handled, margin before/after shown before anything writes.',
    'Package deals are first-class: group lines a vendor priced together ("carriers + bowls, $18,400 all in"), pick the package as one, and the total splits across rows with an editable allocation.',
    'Every applied cost wears a tag on the workbench row — "Ferguson ↩" — and one click reverts to the takeoff number. Package rows revert together, never one shard.',
  ],
}

export default note
