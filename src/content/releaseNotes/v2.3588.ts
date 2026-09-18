import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3588',
  date: '2026-09-18',
  title: 'Takeoffs: the Old view retires — One at a time and Sheet are the two views',
  kind: 'feature',
  highlights: [
    'Bids → Takeoffs no longer offers the classic Old tab on a Combined bid. The pills beside the bid name are One at a time and Sheet; a new device opens One at a time, and a device that had picked Old lands there without being asked again.',
    'The first-open chooser now shows two cards (keys 1 and 2). Print, the book fill, Create PO and assemblies all work exactly as before.',
    'By Stage bids are untouched: they open straight on their assembly-per-fixture editor with no pills.',
  ],
}

export default note
