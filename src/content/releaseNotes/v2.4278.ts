import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4278',
  date: '2026-09-30',
  title: 'Our lien waiver to the GC: the GC’s room shows every waiver, one pair per bill',
  kind: 'feature',
  highlights: [
    'A GC’s room (the customer portal) gains a Lien waivers section: one row per bill they pay, with two columns — the conditional waiver that came with the bill and the unconditional that follows when their check clears. Each is a dated PDF they can open, “on its way” while our leader signs, or “when your check clears” — so their bookkeeper never has to ask.',
    'A homeowner’s page shows the section only when a bill carries a waiver. Nothing about who pays what changes: a GC sees only the bills that are theirs.',
    'The Dashboard’s cleared-releases queue says where Send to the GC is once the unconditional is signed.',
  ],
}

export default note
