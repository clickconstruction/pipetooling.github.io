import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4435',
  date: '2026-10-02',
  title: 'Submittals: the groundwork for fixtures you buy without the GC',
  kind: 'infra',
  highlights: [
    'Some fixtures do not need a submittal. This is the first step toward marking one as order only: you buy it, and the GC never sees it.',
    'Nothing changes on screen yet. The database can now hold the mark.',
    'The GC’s review page, the package and the counts are ready to leave such a fixture out.',
  ],
}

export default note
