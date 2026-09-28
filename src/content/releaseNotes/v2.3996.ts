import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3996',
  date: '2026-09-28',
  title: 'Pipeline: the Working header’s pills look like pills again',
  kind: 'fix',
  highlights: [
    'On Jobs → Stages, the All / Not scheduled / This week / Later pills and the ⇅ Next first button over Working are drawn as rounded pills again, with the one you picked filled in. They had been showing as plain buttons.',
    'Not scheduled turns amber when it has jobs in it, as it was meant to.',
    'Nothing about what the pills do has changed.',
  ],
}

export default note
