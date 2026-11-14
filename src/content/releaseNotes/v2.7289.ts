import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7289',
  date: '2026-11-14',
  title: 'The dev seat and the texting function stop carrying the portal translations',
  kind: 'infra',
  highlights: [
    'Nothing on a screen changes. The portal’s Spanish switch and its two-letter language code moved to a file of their own; everything that read them still finds them where it did.',
    'Two server functions that needed only the switch were carrying every portal translation with it. The dev seat is sent up at 3.91 MB where it was 4.03 MB, and the texting function at 0.28 MB where it was 0.40 MB.',
  ],
}

export default note
