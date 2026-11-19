import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7907',
  date: '2026-11-19',
  title: 'About 200 buttons and chips now draw at the size and weight they were made for',
  kind: 'fix',
  highlights: [
    'Some buttons and chips were drawing at the page’s large, plain text. Their own smaller size and bolder weight were being thrown away. They now draw as designed.',
    'Most of them get a little smaller, so more fit on a row. Many are bolder. The button itself stays as easy to tap, because its height and padding are unchanged.',
    'A picked chip is bold as soon as its list opens. Before, some turned bold only after a press.',
    'They sit across Jobs, Bids, Materials, Prospects and the Lien desk, among them the Builders chips on Permits and the small property letter on a job.',
  ],
}

export default note
