import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2373',
  date: '2026-08-26',
  title: 'Workbench: typed prices save themselves; solver previews survive closing the tab',
  kind: 'feature',
  highlights: [
    'Typing a sale price on the Pricing Workbench now saves it the moment you press Enter or leave the field — a quick green "saved ✓" confirms it. No more Apply for every hand-typed price.',
    'Solver results still preview first, but the preview now waits on your device for real: reload, close the tab, come back tomorrow — it’s still there until you Apply or Discard.',
    'A preview restored from an earlier sitting says when it’s from — "solve from Tue 4:12 PM — restored" — so an old solve never masquerades as fresh work.',
    'The strip’s promise now tells the truth: "saved only when you Apply · waits on this device".',
  ],
}

export default note
