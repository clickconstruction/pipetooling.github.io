import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5715',
  date: '2026-10-21',
  title: 'Messages: the last 7 days in four numbers',
  kind: 'feature',
  highlights: [
    'A strip under the search box on Messages shows the week: answered within an hour, the longest wait right now, texts not delivered, and the estimates sent, opened and accepted.',
    'Each number opens the rows behind it: Needs a reply, the person’s thread, Went out on its texts, or Waiting on them. A tile with nothing behind it reads none.',
    'Answered within an hour counts one wait per run of theirs. A reminder the app sent, a text that never reached them, or a note is not an answer. Last week’s share sits beside it.',
    'Under Mine the strip still shows the office’s numbers, and says so.',
  ],
}

export default note
