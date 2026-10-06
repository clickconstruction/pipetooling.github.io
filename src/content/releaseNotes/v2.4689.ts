import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4689',
  date: '2026-10-06',
  title: 'Submittals: at step 7 the page opens the step it reads from, not the rows too',
  kind: 'fix',
  highlights: [
    'On Bids → Submittals, when the next thing to do was Resubmit, the page opened steps 3, 6 and 8 at once. On BP375 that was fourteen rows and five screens before the log.',
    'Step 7 now opens step 6 alone, Their call, which lists the rows sent back. Open every stage still opens the rest.',
  ],
}

export default note
