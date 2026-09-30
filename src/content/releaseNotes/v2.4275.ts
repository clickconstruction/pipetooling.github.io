import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4275',
  date: '2026-09-30',
  title: 'Our lien waiver to the GC: it travels with the bill, and every bill shows its two waivers',
  kind: 'feature',
  highlights: [
    'Bill Customer on a GC job: a tick, on by default, “Send the lien waiver with this bill” — it names the form the bill picks and why. When the bill has gone, the Release of Lien window opens on that bill: the leader signs (later from his desk, or right now on your screen), then Send to the GC.',
    'The job window’s Bill tab shows two chips on every sent bill of a GC job: the conditional that went with the bill and the unconditional that follows when the check clears — “Conditional ✓ sent Sep 30 · Unconditional · when paid”. One door beside them says the next move: Add waiver, Sign it, Send it, or Add the unconditional once the money has settled.',
    'A bill that went out before this shipped shows “Conditional · none — send it” with Add waiver ›, so any bill already sent can have its waiver added and emailed on the same thread.',
  ],
}

export default note
