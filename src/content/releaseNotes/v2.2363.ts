import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2363',
  date: '2026-08-26',
  title: 'Add several GCs to a bid in one pass',
  kind: 'feature',
  highlights: [
    'On Edit Bid, the "Also sent to" picker now stays open while you tick as many builders as you like — one Add button commits them all, instead of reopening the picker for each GC.',
    'The Add button counts as you go ("Add 3 GCs"), and Cancel or Esc backs out without adding anyone.',
    'A note under the row now explains what it means: GCs added here get the same letter as the bid\'s GC, with a pointer to ＋ Add GC / "track separately" when a builder needs its own prices.',
  ],
}

export default note
