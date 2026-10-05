import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4560',
  date: '2026-10-05',
  title: 'Submittals: Their call says what came back and who is waiting',
  kind: 'feature',
  highlights: [
    'Step 6 now shows one small square for each fixture: green for approved, red for sent back, grey for still waiting. The counts and who answered sit under them.',
    'It lists every part that came back with what the reviewer wrote. On a draft, Edit beside it opens the row to change the part.',
    'The fixtures still waiting are buttons. Press one to type in an answer that came by email, or use "Mark all approved…" when they said yes to the rest.',
    'A fixture with no product is counted apart, here and on the Next line at the top, so the two no longer disagree.',
  ],
}

export default note
