import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4064',
  date: '2026-09-28',
  title: 'Pipeline: the lien runway reads as two lines — the dates, then the verdict',
  kind: 'fix',
  highlights: [
    'The sentence under each billed row\'s lien runway no longer wraps wherever the column happens to break. It is now two deliberate lines: the dates on the first ("pay was due Sep 8 · lien Dec 15"), the verdict on the second ("78 d to the flag", "12 d of room", "file first", "window closed Sep 15").',
    'Neither line wraps mid-sentence, and the verdict is the bolder of the two.',
  ],
}

export default note
