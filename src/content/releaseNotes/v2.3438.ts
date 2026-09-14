import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3438',
  date: '2026-09-14',
  title: 'Stages: the old per-window “offered to the GC” record is retired',
  kind: 'fix',
  highlights: [
    'What a GC sees on their portal has been decided by the eye on each line item (Edit Job → Stages) since the Stage Plan shipped; the older per-window offer flag and its bundles are now removed from the database so nothing can drift from the eye.',
    'The stage calendar on Jobs → Subs → Work no longer carries the unused “Offer to …” and “Take it off their portal” buttons — the GC line there still says whether the stage is shown.',
  ],
}

export default note
