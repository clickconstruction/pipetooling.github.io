import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4280',
  date: '2026-09-30',
  title: 'Our lien waiver to the GC: GC Review shows what each GC holds and what we owe',
  kind: 'feature',
  highlights: [
    'Open a GC’s row in GC Review and each bill now carries a Lien waivers column: two chips, the conditional that went with the bill and the unconditional that follows when the check clears — “Conditional ✓ sent Sep 30 · Unconditional · when paid”.',
    'An amber chip is the thing to do before the call — “Conditional · none — send it”, or “Unconditional owed · settled” once the check has cleared. Click either chip to open the job, where the Bill tab’s door adds or sends it.',
  ],
}

export default note
